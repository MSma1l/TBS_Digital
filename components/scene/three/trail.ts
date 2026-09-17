/**
 * The cursor circuit trail's mesh: one flat P5 ribbon (materials.ts `TUBE_MODE.trail`) holding
 * every segment of the ring buffer (../trail.ts), in DOCUMENT px. No new program — the P5
 * source is already compiled for the rest of the scene — and one draw, only while a segment
 * is still fading.
 *
 * Geometry: `TRAIL.cap` segments × 6 non-indexed vertices (two triangles, counter-clockwise
 * in document px). `position` is the segment's start or end, `normal` half of the in-plane
 * perpendicular (the vertex shader offsets by `normal * uWidth`, so `uWidth` is the full width in
 * CSS px), `uv.x` 0 → 1 along the segment and `aTag` its birth time. Only the slots the listener
 * wrote are re-uploaded (`addUpdateRange`); a wrapped ring uploads the whole buffer.
 *
 * Per frame only uniforms and the mesh's transform change. Document px map onto the z = 0 plane
 * exactly as `fitAnchor` maps a host (choreography.ts): x = (docX − w/2)·k and
 * y = −(docY − canvasTop − h/2)·k, with k = `worldPerPx(h)` — so the circuit stays on the page
 * while it scrolls. The mirrored y makes the matrix's determinant negative; three flips the
 * front face for it, so the counter-clockwise triangles still face the camera.
 *
 * It draws over everything else in the scene (render order 9, no depth test) and is never
 * frustum-culled. `update` owns `mesh.visible`.
 */

import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Mesh } from "three";
import type { ScrollProbe } from "@/lib/scene";
import { canvasDocTop, worldPerPx } from "../choreography";
import { TRAIL, TRAIL_STRIDE, trailCap, type TrailBuffer } from "../trail";
import { TUBE_MODE, createTubeMaterial, paint, type ColorRoles } from "./materials";
import type { ScenePalette } from "./palette";

export type TrailFrame = {
  trail: TrailBuffer;
  /** `window.scrollY`, read once this frame. */
  scrollY: number;
  probe: ScrollProbe;
  /** The canvas's size, CSS px. */
  w: number;
  h: number;
  /** The palette draws ink on the light page. */
  ink: boolean;
};

export type TrailMesh = {
  mesh: Mesh;
  update(frame: TrailFrame): void;
  setPalette(palette: ScenePalette): void;
  dispose(): void;
};

export const TRAIL_ROLES: ColorRoles = { a: "blue", b: "cyan", hot: "red" };
/** Resting strength of a fresh segment (the code pulse adds to it). */
export const TRAIL_ALPHA = { glow: 0.7, ink: 0.55 } as const;
/** After the core (1–5), the models (5–7) and the swarm (8). */
export const TRAIL_RENDER_ORDER = 9;

/** Vertices per segment, and for each: which end (0 start, 1 end) and which side of the line. */
export const TRAIL_VERTICES = 6;
const END = [0, 1, 1, 0, 1, 0] as const;
const SIDE = [-1, -1, 1, -1, 1, 1] as const;

/** Update ranges an attribute may queue while it is not drawn; past this, one full upload. */
const MAX_RANGES = 16;

export function createTrailMesh(palette: ScenePalette): TrailMesh {
  const slots = TRAIL.cap;
  const vertices = slots * TRAIL_VERTICES;
  const position = new BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(DynamicDrawUsage);
  const normal = new BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(DynamicDrawUsage);
  const tag = new BufferAttribute(new Float32Array(vertices), 1).setUsage(DynamicDrawUsage);
  const uvs = new Float32Array(vertices * 2);
  for (let v = 0; v < vertices; v += 1) {
    const corner = v % TRAIL_VERTICES;
    uvs[v * 2] = END[corner];
    uvs[v * 2 + 1] = (SIDE[corner] + 1) / 2;
  }
  const dynamic = [position, normal, tag] as const;

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", position);
  geometry.setAttribute("normal", normal);
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.setAttribute("aTag", tag);
  geometry.setDrawRange(0, 0);

  const material = createTubeMaterial({
    mode: TUBE_MODE.trail,
    roles: TRAIL_ROLES,
    alpha: TRAIL_ALPHA.glow,
    width: TRAIL.widthPx.glow,
  });
  // An overlay on the page: never hidden behind a part of the chip (depth test is not in the program key).
  material.material.depthTest = false;
  paint(material, palette);

  const mesh = new Mesh(geometry, material.material);
  mesh.name = "scene-trail";
  mesh.renderOrder = TRAIL_RENDER_ORDER;
  mesh.frustumCulled = false;
  mesh.visible = false;

  /** A full upload is queued and has not reached the GPU yet: partial ranges would cut it short. */
  let fullPending = false;
  position.onUpload(() => {
    fullPending = false;
  });

  const p = position.array as Float32Array;
  const n = normal.array as Float32Array;
  const a = tag.array as Float32Array;

  /** Segment `slot` of the ring → its six vertices. */
  const fill = (seg: Float32Array, slot: number) => {
    const o = slot * TRAIL_STRIDE;
    const x0 = seg[o];
    const y0 = seg[o + 1];
    const x1 = seg[o + 2];
    const y1 = seg[o + 3];
    const t = seg[o + 4];
    const len = Math.hypot(x1 - x0, y1 - y0);
    // Half the unit perpendicular: the shader's `normal * uWidth` spans the full width.
    const nx = len > 0 ? (-(y1 - y0) / len) * 0.5 : 0;
    const ny = len > 0 ? ((x1 - x0) / len) * 0.5 : 0;
    for (let c = 0; c < TRAIL_VERTICES; c += 1) {
      const v = slot * TRAIL_VERTICES + c;
      const end = END[c] === 1;
      const side = SIDE[c];
      p[v * 3] = end ? x1 : x0;
      p[v * 3 + 1] = end ? y1 : y0;
      p[v * 3 + 2] = 0;
      n[v * 3] = nx * side;
      n[v * 3 + 1] = ny * side;
      n[v * 3 + 2] = 0;
      a[v] = t;
    }
  };

  const upload = (trail: TrailBuffer) => {
    const dirty = trail.dirty;
    if (dirty === null) return;
    trail.dirty = null;
    const count = Math.min(trail.count, slots, trailCap(trail));
    let start = 0;
    let end = count;
    if (dirty !== "all") {
      start = Math.max(0, dirty[0]);
      end = Math.min(dirty[1], slots);
      if (end <= start) return;
    }
    for (let slot = start; slot < end; slot += 1) fill(trail.seg, slot);
    const full = dirty === "all" || fullPending || position.updateRanges.length >= MAX_RANGES;
    for (const attribute of dynamic) {
      if (full) attribute.clearUpdateRanges();
      else attribute.addUpdateRange(start * TRAIL_VERTICES * attribute.itemSize, (end - start) * TRAIL_VERTICES * attribute.itemSize);
      attribute.needsUpdate = true;
    }
    if (full) fullPending = true;
  };

  return {
    mesh,

    update(frame) {
      const trail = frame.trail;
      upload(trail);
      const count = Math.min(trail.count, slots, trailCap(trail));
      const now = performance.now() / 1000 - trail.epoch;
      const cap = trailCap(trail);
      const newest = count > 0 ? trail.seg[((trail.head - 1 + cap) % cap) * TRAIL_STRIDE + 4] : -Infinity;
      mesh.visible = now - newest < TRAIL.life;
      if (!mesh.visible) return;

      geometry.setDrawRange(0, count * TRAIL_VERTICES);
      const k = worldPerPx(frame.h);
      const top = canvasDocTop(frame.scrollY, frame.probe, frame.h);
      mesh.scale.set(k, -k, 1);
      mesh.position.set((-frame.w / 2) * k, (top + frame.h / 2) * k, 0);
      const u = material.uniforms;
      u.uTime.value = now;
      u.uWidth.value = frame.ink ? TRAIL.widthPx.ink : TRAIL.widthPx.glow;
      u.uAlpha.value = frame.ink ? TRAIL_ALPHA.ink : TRAIL_ALPHA.glow;
    },

    setPalette(next) {
      paint(material, next);
    },

    dispose() {
      geometry.dispose();
      material.material.dispose();
    },
  };
}
