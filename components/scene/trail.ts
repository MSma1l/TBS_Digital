/**
 * The cursor circuit trail's model: a ring buffer of neon segments laid down behind a fine
 * pointer. Pure on purpose — no three.js, no DOM — so the listener (input.ts) pays microseconds
 * per move and the unit tests pin the snapping as tables.
 *
 * Every sample is snapped to a `TRAIL.grid`-px DOCUMENT grid and joined to the previous one by a
 * Manhattan L (the longer leg first), so the circuit is drawn in page space and stays where it
 * was laid while the page scrolls. A pause longer than `breakGap` or a jump of more than
 * `maxJumpCells` cells starts a new chain without a segment (a pointer that left the window and
 * came back somewhere else never draws a wire across the page).
 *
 * Times are seconds since `epoch` (`performance.now() / 1000` when the buffer was created), so a
 * birth time stays small enough for float32 attributes. The mesh (three/trail.ts) fades each
 * segment over `TRAIL.life` in the shader: nothing here ever expires a segment, the ring simply
 * overwrites the oldest.
 */

export const TRAIL = {
  /** Snapping grid, CSS px of the document. */
  grid: 20,
  /** Seconds a segment takes to fade out. */
  life: 0.9,
  /** A longer gap between two samples starts a new chain. */
  breakGap: 0.35,
  /** A longer jump (in cells, on either axis) starts a new chain. */
  maxJumpCells: 12,
  /** The ribbon's full width in CSS px: a glow line on the dark page, ink on the light one. */
  widthPx: { glow: 2, ink: 1.5 },
  /** Segments kept (every tier: 64 × 6 vertices is not worth a tier field). */
  cap: 64,
} as const;

/** Floats per segment in `seg`: x0, y0, x1, y1, birth time. */
export const TRAIL_STRIDE = 5;

export type TrailBuffer = {
  /** `cap × 5` floats per segment: x0, y0, x1, y1 (document px), t (seconds since `epoch`). */
  seg: Float32Array;
  /** The slot the next segment is written to. */
  head: number;
  /** Segments stored, up to `cap` (slots `0..count-1` until the ring first wraps). */
  count: number;
  /** The last snapped sample (NaN before the first) and its time: where the chain continues. */
  lastX: number;
  lastY: number;
  lastT: number;
  /** `performance.now() / 1000` at creation; every `t` is relative to it. */
  epoch: number;
  /**
   * Slots written since the mesh last uploaded: null (nothing), a half-open segment range
   * `[start, end)` (`start < end ≤ cap`) of contiguous writes, or "all" once the writes are no
   * longer contiguous — the ring wrapped from its last slot to slot 0 inside one range. Only
   * the mesh (three/trail.ts) reads it, and it clears it back to null after uploading.
   */
  dirty: [number, number] | "all" | null;
};

export function createTrailBuffer(cap: number, epoch: number): TrailBuffer {
  const slots = Math.max(1, Math.floor(cap));
  return {
    seg: new Float32Array(slots * TRAIL_STRIDE),
    head: 0,
    count: 0,
    lastX: Number.NaN,
    lastY: Number.NaN,
    lastT: Number.NaN,
    epoch: Number.isFinite(epoch) ? epoch : 0,
    dirty: null,
  };
}

/** The capacity of `b`, in segments. */
export function trailCap(b: TrailBuffer): number {
  return b.seg.length / TRAIL_STRIDE;
}

function write(b: TrailBuffer, x0: number, y0: number, x1: number, y1: number, t: number): number {
  const cap = trailCap(b);
  const slot = b.head;
  const o = slot * TRAIL_STRIDE;
  b.seg[o] = x0;
  b.seg[o + 1] = y0;
  b.seg[o + 2] = x1;
  b.seg[o + 3] = y1;
  b.seg[o + 4] = t;
  b.head = (slot + 1) % cap;
  if (b.count < cap) b.count += 1;
  const dirty = b.dirty;
  if (dirty === null) b.dirty = [slot, slot + 1];
  else if (dirty !== "all") {
    if (dirty[1] === slot) dirty[1] = slot + 1;
    else b.dirty = "all";
  }
  return 1;
}

/**
 * A pointer sample in document px at `tSec` (the event's clock, seconds) → 0..2 orthogonal
 * segments (an L), snapped to the document grid. Returns how many segments were written.
 */
export function pushTrail(b: TrailBuffer, docX: number, docY: number, tSec: number): number {
  const gx = Math.round(docX / TRAIL.grid) * TRAIL.grid;
  const gy = Math.round(docY / TRAIL.grid) * TRAIL.grid;
  const t = tSec - b.epoch;
  if (!Number.isFinite(gx) || !Number.isFinite(gy) || !Number.isFinite(t)) {
    // An unusable sample breaks the chain.
    b.lastX = Number.NaN;
    return 0;
  }
  if (
    Number.isNaN(b.lastX) ||
    t - b.lastT > TRAIL.breakGap ||
    Math.max(Math.abs(gx - b.lastX), Math.abs(gy - b.lastY)) > TRAIL.maxJumpCells * TRAIL.grid
  ) {
    // A chain break: remember the sample, draw nothing.
    b.lastX = gx;
    b.lastY = gy;
    b.lastT = t;
    return 0;
  }
  if (gx === b.lastX && gy === b.lastY) {
    b.lastT = t;
    return 0;
  }
  const horizontalFirst = Math.abs(gx - b.lastX) >= Math.abs(gy - b.lastY);
  // The elbow of the L.
  const ex = horizontalFirst ? gx : b.lastX;
  const ey = horizontalFirst ? b.lastY : gy;
  let n = 0;
  if (ex !== b.lastX || ey !== b.lastY) n += write(b, b.lastX, b.lastY, ex, ey, t);
  if (ex !== gx || ey !== gy) n += write(b, ex, ey, gx, gy, t);
  b.lastX = gx;
  b.lastY = gy;
  b.lastT = t;
  return n;
}
