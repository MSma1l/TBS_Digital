/**
 * The hero's stat panels' faces: a metric card redrawn on a small Canvas2D and uploaded as one
 * `CanvasTexture`, which `models/statPanel.ts` draws on `SURFACE_MODE.holo` — the Work hologram's
 * own branch, so the number arrives under the same scanlines, in the same hairline frame, in the
 * palette's own colour.
 *
 * **The card is the source, not a copy of it.** Every string is the card's own `textContent` and
 * every type size, weight, family, margin and padding is its own COMPUTED style, scaled by the one
 * ratio between the canvas and the card's box. So the face carries whatever the hero renders — the
 * counted portfolio number, the visitor's language, a copy change, a token change — with nothing
 * duplicated here and no per-locale asset to keep in step. The `<html lang>` observer inside
 * `createHologramSource` recomposes on a language switch; the model asks for a fresh compose when
 * the window is re-measured or the text changes under it.
 *
 * **Greyscale on purpose.** The `holo` branch keeps a coloured pixel's own hue and maps a grey one
 * into the palette, so anything drawn here in colour would be a surface with a colour the palette
 * did not give it — allowed for a screenshot on the laptop's display, not for the hero's own
 * numbers. The two cards' accents (red for the portfolio, blue for the automations) are carried the
 * way the cards themselves carry them: by the WIREFRAME in the corner, an octahedron on one and a
 * ring gyroscope on the other, and by nothing else.
 *
 * Privacy and CSP by construction, like `hologram.ts`: no loader, no fetch, no blob, no image at
 * all; `fillText` / `strokeText` on DOM text, nothing parsed, and the canvas is never read back.
 */

import { SCENE_TIER_CONFIG, type SceneCanvasTier } from "../tiers";

/** The largest stat face a tier draws (px). Bigger than a hologram: this one carries the copy. */
export const statFaceMax = (tier: SceneCanvasTier): readonly [number, number] =>
  SCENE_TIER_CONFIG[tier].statFace;

/**
 * The face's own numbers, as shares or px of the CARD — everything else is read off the card's
 * computed style. These are the few things the DOM does not state:
 *
 *  · `rule` — the hairline under the number, in css px of the card, and the air above and below it.
 *    The card draws its own rule as a gradient on `::before` along its top edge, which the shader's
 *    frame term already gives the panel; this one sits where the eye needs a break between a 48px
 *    number and 16px copy.
 *  · `accent` — the wireframe's box in the top-right corner: its size as a share of the card's
 *    SHORT side and its inset, so it lands where the card's own hologram sits (`-top-5 -right-5`,
 *    cropped by the card's `overflow-hidden`) without ever crossing the copy.
 *  · `bracket` — the corner brackets, the hologram's own language (`HOLOGRAM.bracket`).
 *  · `dim` — how bright each row is drawn. The card's hierarchy is three colours (`--txt` for the
 *    number, `--mut` for the label, `--green-text` for the note); on a greyscale face that
 *    hierarchy is alpha, and the shader turns alpha into light.
 */
/**
 * WHICH COLOUR EACH ROW IS DRAWN IN, as a custom property read off the card itself.
 *
 * The face used to be composed entirely in `#fff` — a pure alpha mask — and the shader gave the
 * whole thing one palette colour. That is why the panels read GREY next to a chip that is cyan,
 * blue and red: the holo branch keeps a pixel's OWN hue only where the canvas has one
 * (`sat` in materials.ts), and a white canvas has none, so every row fell back to the palette
 * mixed 35% towards `uHot` — which is `--txt`, very nearly white.
 *
 * So each row is now drawn in a real colour, and the shader carries it through. They are the
 * CARD's own properties, not literals: `--accent` is already red on the portfolio card and blue
 * on the automation one (Hero.tsx), which is what makes the two panels read as a pair rather
 * than as two of the same thing.
 */
const ROW_TINT = {
  /**
   * The number: the card's accent in its TEXT tone, not the raw brand colour. A saturated red
   * carries about a third of white's luminance, so the first coloured draft read as dim rather
   * than as coloured — the `*-text` tones exist exactly for type on this background.
   */
  value: "--accent-text",
  /** The rule under the number: the raw accent, because a solid 2px bar can take the full colour. */
  rule: "--accent",
  /** The label under it, one step back from the number but still in the family. */
  label: "--cyan-text",
  /** The note keeps the colour the card gives it, which is already not grey. */
  note: "--green-text",
  /** The brackets, the tick and the wireframe: the hologram's own line colour. */
  line: "--cyan-text",
} as const;

/**
 * A colour from the card's own computed style, or white where the page does not define it.
 *
 * A custom property can still read back as an unresolved `var(...)` — assigning that to
 * `fillStyle` is a silent no-op and the row would take whatever colour was set last, which is a
 * bug that only shows as the wrong colour. It is rejected here instead.
 */
function tintOf(style: CSSStyleDeclaration, property: string): string {
  const value = style.getPropertyValue(property).trim();
  return value === "" || value.startsWith("var(") ? "#fff" : value;
}

export const STAT_FACE = {
  rule: { width: 28, weight: 2, above: 5, below: 5 },
  /**
   * The wireframe hangs off the top-right corner, like the card's own (`-top-5 -right-5`, cropped
   * by its `overflow-hidden`): `hang` is the share of its radius that stays inside the face. Inside
   * it entirely, it crosses a wide number — `24/7` at 48px reached within a few px of it, and the
   * Russian `1 день` (2026-10-09) is wider still.
   */
  accent: { share: 0.34, hang: 0.55 },
  bracket: { arm: 12, inset: 4, width: 1.5 },
  /**
   * The faint fill over the whole face. The card it replaces had GLASS behind its copy — a blurred,
   * darkened plate that separated the words from whatever was under them. An additive hologram
   * cannot darken anything, so it does the opposite: it lifts its own pane a little, and the
   * scanlines comb it, which is what makes the panel read as a surface in front of the chip rather
   * than as words floating over it. Small on purpose — at 0.1 it starts to look like a lit box.
   */
  plate: 0.055,
  dim: { value: 1, label: 0.8, note: 0.86, rule: 0.6, accent: 0.55 },
  /** The label is allowed this many lines; a longer one is clipped with an ellipsis. */
  labelLines: 3,
  /**
   * The note and the group tick share one baseline, the note from the left and the tick from the
   * right. This is the gap between them, in the card's own px — and the note is FITTED to what is
   * left once the tick has taken its width. Without that reservation a long note ran straight
   * through the tick: at the hero's 192px card, "EXPERIENȚĂ APLICATĂ" and "01" overlapped.
   */
  tickGap: 6,
  /** The note never shrinks below this, in the card's own px; past it the note is the problem. */
  noteMin: 7,
} as const;

/* ---- the wireframe accent ------------------------------------------------------------------- */

/**
 * The two shapes the cards carry, by metric id — the same split `hologramShapeFor` makes in the
 * hero: the portfolio counter gets the octahedron, everything else the ring gyroscope.
 */
export type StatShape = "octahedron" | "rings";

export const statShapeFor = (metric: string): StatShape =>
  metric === "projects" ? "octahedron" : "rings";

/** A unit octahedron's six vertices, in the order the edges below index them. */
const OCTA: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** Its twelve edges: every pair of vertices that is not a pair of opposites. */
const OCTA_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
  [2, 4],
  [2, 5],
  [3, 4],
  [3, 5],
];

/**
 * Pure. A point of the unit shape turned by `yaw` about y then `pitch` about x, projected flat
 * (orthographic — the shape is 34% of a 140px box, where perspective is a rounding error) into a
 * `radius`-px circle centred at (`cx`, `cy`). Exported for the unit tests, which pin the silhouette
 * rather than a screenshot.
 */
export function projectAccent(
  point: readonly [number, number, number],
  yaw: number,
  pitch: number,
  cx: number,
  cy: number,
  radius: number,
): readonly [number, number] {
  const [x, y, z] = point;
  const sy = Math.sin(yaw);
  const cyaw = Math.cos(yaw);
  const x1 = x * cyaw + z * sy;
  const z1 = -x * sy + z * cyaw;
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  const y1 = y * cp - z1 * sp;
  return [cx + x1 * radius, cy - y1 * radius];
}

/** The resting pose the hero's CSS hologram is parked on: `rotateX(-20deg) rotateY(35deg)`. */
export const ACCENT_POSE = { yaw: (35 * Math.PI) / 180, pitch: (-20 * Math.PI) / 180 } as const;

/**
 * The wireframe in the corner: twelve edges of an octahedron, or three rings on the same three
 * planes the hero's CSS gyroscope uses. Hairlines, no vertex dots — the no-dots rule holds inside a
 * texture too.
 */
function drawAccent(
  ctx: CanvasRenderingContext2D,
  shape: StatShape,
  cx: number,
  cy: number,
  radius: number,
  lineWidth: number,
): void {
  ctx.lineWidth = lineWidth;
  if (shape === "octahedron") {
    ctx.beginPath();
    for (const [a, b] of OCTA_EDGES) {
      const from = projectAccent(OCTA[a], ACCENT_POSE.yaw, ACCENT_POSE.pitch, cx, cy, radius);
      const to = projectAccent(OCTA[b], ACCENT_POSE.yaw, ACCENT_POSE.pitch, cx, cy, radius);
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(to[0], to[1]);
    }
    ctx.stroke();
    return;
  }
  /* three rings: the xy plane, then one tipped about x and one about y — the CSS gyroscope's own
     three transforms, sampled rather than transformed, so the ellipses are exact. */
  const STEPS = 48;
  for (const plane of [0, 1, 2] as const) {
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i += 1) {
      const a = (i / STEPS) * Math.PI * 2;
      const u = Math.cos(a);
      const v = Math.sin(a);
      const point: readonly [number, number, number] =
        plane === 0 ? [u, v, 0] : plane === 1 ? [u, 0, v] : [0, u, v];
      const [px, py] = projectAccent(point, ACCENT_POSE.yaw, ACCENT_POSE.pitch, cx, cy, radius);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

/* ---- text ----------------------------------------------------------------------------------- */

/** Whitespace collapsed, trimmed. */
const textOf = (node: Element | null) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();

const pxOf = (style: CSSStyleDeclaration, property: string): number => {
  const value = Number.parseFloat(style.getPropertyValue(property));
  return Number.isFinite(value) ? value : 0;
};

/** A font shorthand from a computed style, at `px`. */
const fontAt = (style: CSSStyleDeclaration | null, px: number): string =>
  `${style?.fontWeight || "400"} ${Math.max(1, Math.round(px))}px ${style?.fontFamily || "sans-serif"}`;

function upper(text: string): string {
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
  try {
    return text.toLocaleUpperCase(lang || undefined);
  } catch {
    return text.toUpperCase();
  }
}

/**
 * Pure enough to test: `text` broken into at most `maxLines` lines that each fit `room`, measured
 * by `width`. A word longer than the room is left on its own line (the last line is then cut with
 * an ellipsis by the caller's own measure), and everything past the last line is dropped with an
 * ellipsis on it — the card wraps its label in exactly the same two or three lines.
 */
export function wrapLines(
  text: string,
  room: number,
  maxLines: number,
  width: (text: string) => number,
): string[] {
  const words = text.split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${line} ${words[i]}`;
    if (width(next) <= room || line === "") {
      line = next;
      continue;
    }
    lines.push(line);
    line = words[i];
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines) {
    /* anything that did not fit is said with an ellipsis on the last line */
    const used = lines.join(" ").length;
    if (used < text.replace(/\s+/g, " ").length) {
      let cut = lines[maxLines - 1];
      while (cut.length > 1 && width(`${cut}…`) > room) cut = cut.slice(0, -1);
      lines[maxLines - 1] = `${cut.trimEnd()}…`;
    }
  }
  return lines;
}

/** The largest size ≤ `px` (never below `min`) at which `text` fits `room`. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  room: number,
  px: number,
  min: number,
  font: (px: number) => string,
): number {
  let size = px;
  ctx.font = font(size);
  while (size > min && ctx.measureText(text).width > room) {
    size -= 1;
    ctx.font = font(size);
  }
  return size;
}

/** Letter spacing, where the browser has it (Chromium 99+, Safari 17.4+); ignored where it has not. */
function withTracking(ctx: CanvasRenderingContext2D, em: number, px: number, draw: () => void): void {
  const target = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const had = typeof target.letterSpacing === "string" ? target.letterSpacing : null;
  if (had !== null) target.letterSpacing = `${(em * px).toFixed(2)}px`;
  try {
    draw();
  } finally {
    if (had !== null) target.letterSpacing = had;
  }
}

/* ---- the composer --------------------------------------------------------------------------- */

/**
 * Compose `card` — a hero metric card (`[data-metric]`) — into `ctx` at `size`.
 *
 * The one ratio: `s = canvasHeight / cardLayoutHeight`. Every px below is a css px of the card times `s`,
 * so the face is the card's own typography at the canvas's scale and nothing is authored twice. The
 * number is fitted down if a language makes it wider than the card (the Russian `1 день` may, since
 * 2026-10-09), and the label wraps the way the card wraps it.
 *
 * `index` is the card's place in the group, drawn as the hologram's two-digit tick in the corner —
 * the one thing on the face that is not the card's own text, and the same figure the Work hologram
 * draws. Resolves `"text"`: there is no image path here, and never rejects.
 */
export async function composeStatFace(
  card: HTMLElement,
  ctx: CanvasRenderingContext2D,
  size: readonly [number, number],
  index: number,
): Promise<"text"> {
  const [w, h] = size;
  /* `offsetHeight`, not a rendered box: the card is transformed by the intro's entrance, by the
     scroll parallax and by its own tilt, and the face has to be drawn to the box it RESTS at — the
     same box `writeStatWindows` measures and `placeStat` fits the panel to. */
  const s = card.offsetHeight > 0 ? h / card.offsetHeight : 1;

  const cardStyle = getComputedStyle(card);
  const value = card.querySelector<HTMLElement>(":scope > b");
  const label = card.querySelector<HTMLElement>(":scope > span:not([data-hologram])");
  const note = card.querySelector<HTMLElement>(":scope > small");
  const valueStyle = value ? getComputedStyle(value) : null;
  const labelStyle = label ? getComputedStyle(label) : null;
  const noteStyle = note ? getComputedStyle(note) : null;

  const padX = pxOf(cardStyle, "padding-left") * s;
  const padY = pxOf(cardStyle, "padding-top") * s;
  const room = Math.max(1, w - 2 * padX);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, w, h);
  const lineTint = tintOf(cardStyle, ROW_TINT.line);
  ctx.fillStyle = lineTint;
  ctx.strokeStyle = lineTint;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.textAlign = "left";

  /* the wireframe accent, first: the card draws its hologram under the copy, and a stroke that
     crossed a letter would read as a scratch on the glass rather than as a shape behind it. */
  /* the pane itself: one faint fill, combed by the shader's scanlines */
  ctx.globalAlpha = STAT_FACE.plate;
  ctx.fillRect(0, 0, w, h);

  const short = Math.min(w, h);
  const radius = (short * STAT_FACE.accent.share) / 2;
  const hang = radius * STAT_FACE.accent.hang;
  ctx.globalAlpha = STAT_FACE.dim.accent;
  drawAccent(
    ctx,
    statShapeFor(card.dataset.metric ?? ""),
    w - hang,
    hang,
    radius,
    Math.max(1, STAT_FACE.bracket.width * s),
  );

  /* the number */
  let y = padY;
  const valueText = textOf(value);
  if (valueText) {
    const font = (px: number) => fontAt(valueStyle, px);
    const px = fitFont(ctx, valueText, room, pxOf(valueStyle!, "font-size") * s, Math.round(14 * s), font);
    ctx.font = font(px);
    ctx.textBaseline = "top";
    ctx.globalAlpha = STAT_FACE.dim.value;
    ctx.fillStyle = tintOf(cardStyle, ROW_TINT.value);
    ctx.fillText(valueText, padX, y);
    /* the card's number is `leading-none`: its line box IS its size */
    y += px;
  }

  /* the rule under it */
  ctx.globalAlpha = STAT_FACE.dim.rule;
  ctx.fillStyle = tintOf(cardStyle, ROW_TINT.rule);
  const ruleY = Math.round(y + STAT_FACE.rule.above * s);
  ctx.fillRect(padX, ruleY, Math.max(2, STAT_FACE.rule.width * s), Math.max(1, STAT_FACE.rule.weight * s));
  y = ruleY + Math.max(1, STAT_FACE.rule.weight * s) + STAT_FACE.rule.below * s;

  /* the label, wrapped as the card wraps it */
  const labelText = textOf(label);
  if (labelText && labelStyle) {
    const px = pxOf(labelStyle, "font-size") * s;
    const lead = pxOf(labelStyle, "line-height") * s || px * 1.4;
    ctx.font = fontAt(labelStyle, px);
    ctx.textBaseline = "top";
    ctx.globalAlpha = STAT_FACE.dim.label;
    ctx.fillStyle = tintOf(cardStyle, ROW_TINT.label);
    const lines = wrapLines(labelText, room, STAT_FACE.labelLines, (text) => ctx.measureText(text).width);
    for (const line of lines) {
      ctx.fillText(line, padX, y);
      y += lead;
    }
  }

  /* The group tick is measured FIRST, because the note shares its baseline and has to leave it
     room. Drawn after, so the note cannot paint over it either. */
  const tickText = String(Number.isFinite(index) ? Math.max(0, Math.floor(index)) + 1 : 1).padStart(2, "0");
  const tickPx = Math.max(8, pxOf(noteStyle ?? cardStyle, "font-size") * s);
  ctx.font = fontAt(noteStyle, tickPx);
  const tickRoom = ctx.measureText(tickText).width + STAT_FACE.tickGap * s;

  /* the note, upper case and tracked, on the card's own baseline from the foot */
  const noteText = textOf(note);
  if (noteText && noteStyle) {
    const px = pxOf(noteStyle, "font-size") * s;
    const tracking = pxOf(noteStyle, "letter-spacing") / Math.max(1, pxOf(noteStyle, "font-size"));
    const em = Number.isFinite(tracking) ? tracking : 0;
    const text = upper(noteText);
    /* Fitted INSIDE the tracking, because tracking adds one gap per character and a note measured
       without it is wrong by most of its own width at this size. */
    let size = px;
    withTracking(ctx, em, px, () => {
      size = fitFont(ctx, text, w - padX * 2 - tickRoom, px, STAT_FACE.noteMin * s, (v) =>
        fontAt(noteStyle, v),
      );
    });
    ctx.font = fontAt(noteStyle, size);
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = STAT_FACE.dim.note;
    ctx.fillStyle = tintOf(cardStyle, ROW_TINT.note);
    withTracking(ctx, em, size, () => {
      ctx.fillText(text, padX, h - padY);
    });
  }

  /* the group tick and the bracket corners: the hologram's own language */
  ctx.globalAlpha = STAT_FACE.dim.rule;
  ctx.fillStyle = lineTint;
  ctx.strokeStyle = lineTint;
  ctx.font = fontAt(noteStyle, tickPx);
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(tickText, w - padX, h - padY);
  ctx.textAlign = "left";

  const arm = Math.round(STAT_FACE.bracket.arm * s);
  const corner = Math.round(STAT_FACE.bracket.inset * s);
  ctx.lineWidth = Math.max(1, Math.round(STAT_FACE.bracket.width * s));
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [
    [corner, corner, 1, 1],
    [w - corner, corner, -1, 1],
    [corner, h - corner, 1, -1],
    [w - corner, h - corner, -1, -1],
  ] as const) {
    ctx.moveTo(cx, cy + dy * arm);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * arm, cy);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  return "text";
}
