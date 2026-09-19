import { describe, expect, it, vi } from "vitest";
import { DynamicDrawUsage, OneFactor, OneMinusSrcAlphaFactor, Vector3, type BufferAttribute } from "three";
import { fitAnchor, worldPerPx } from "@/components/scene/choreography";
import { createSceneFx } from "@/components/scene/fx";
import { attachTiltInput, type TiltHost } from "@/components/scene/input";
import { toColor, TUBE_MODE, type TubeUniforms } from "@/components/scene/three/materials";
import { pickSceneRoles } from "@/components/scene/three/palette";
import { TRAIL_ALPHA, TRAIL_RENDER_ORDER, TRAIL_VERTICES, createTrailMesh } from "@/components/scene/three/trail";
import { TRAIL, TRAIL_STRIDE, createTrailBuffer, pushTrail, type TrailBuffer } from "@/components/scene/trail";
import { createScrollProbe } from "@/lib/scene";

/*
 * The cursor circuit trail: a fine pointer lays neon segments snapped to a 20px DOCUMENT grid
 * as Manhattan L's; the ring keeps the last `TRAIL.cap` and the shader fades each over
 * `TRAIL.life`. The pure model is pinned as tables; the listener only pushes for a mouse or a
 * pen; the mesh uploads only what was written and sits in document px exactly as `fitAnchor`
 * places a host. three.js runs in jsdom for everything but a WebGL context.
 */

type Seg = [number, number, number, number, number];

function segments(b: TrailBuffer): Seg[] {
  return Array.from({ length: b.count }, (_, slot) => Array.from(b.seg.subarray(slot * TRAIL_STRIDE, (slot + 1) * TRAIL_STRIDE)) as Seg);
}

const axisAligned = ([x0, y0, x1, y1]: Seg) => (x0 === x1) !== (y0 === y1);

describe("pushTrail — Manhattan segments on the document grid", () => {
  it("the first sample only starts the chain", () => {
    const b = createTrailBuffer(TRAIL.cap, 0);
    expect(b.lastX).toBeNaN();
    expect(pushTrail(b, 109, 91, 0)).toBe(0);
    expect([b.lastX, b.lastY, b.lastT]).toEqual([100, 100, 0]);
    expect(b.count).toBe(0);
    expect(b.dirty).toBeNull();
  });

  it("H then V gives an L: two axis-aligned segments that meet", () => {
    const b = createTrailBuffer(TRAIL.cap, 0);
    pushTrail(b, 100, 100, 0);
    expect(pushTrail(b, 161, 104, 0.02)).toBe(1);
    expect(pushTrail(b, 158, 179, 0.04)).toBe(1);
    const [h, v] = segments(b);
    expect(h.slice(0, 4)).toEqual([100, 100, 160, 100]);
    expect(v.slice(0, 4)).toEqual([160, 100, 160, 180]);
    expect(segments(b).every(axisAligned)).toBe(true);
    expect(h[4]).toBeCloseTo(0.02, 6);
  });

  it("a diagonal gives two orthogonal segments through an elbow, the longer leg first", () => {
    const b = createTrailBuffer(TRAIL.cap, 0);
    pushTrail(b, 100, 100, 0);
    expect(pushTrail(b, 160, 140, 0.016)).toBe(2);
    expect(segments(b).map((s) => s.slice(0, 4))).toEqual([
      [100, 100, 160, 100],
      [160, 100, 160, 140],
    ]);
    // Taller than wide: vertical first.
    expect(pushTrail(b, 180, 220, 0.032)).toBe(2);
    expect(segments(b).slice(2).map((s) => s.slice(0, 4))).toEqual([
      [160, 140, 160, 220],
      [160, 220, 180, 220],
    ]);
    expect(segments(b).every(axisAligned)).toBe(true);
    // Both legs of one sample are born together.
    expect(b.seg[4]).toBe(b.seg[TRAIL_STRIDE + 4]);
  });

  it("the same cell gives nothing but keeps the chain alive", () => {
    const b = createTrailBuffer(TRAIL.cap, 0);
    pushTrail(b, 100, 100, 0);
    expect(pushTrail(b, 108, 92, 0.3)).toBe(0);
    expect(pushTrail(b, 95, 105, 0.6)).toBe(0);
    expect(b.count).toBe(0);
    // 0.6s since the chain started, but only 0.3s since the last sample.
    expect(pushTrail(b, 140, 100, 0.9)).toBe(1);
  });

  it(`a gap over ${TRAIL.breakGap}s or a jump over ${TRAIL.maxJumpCells} cells breaks the chain`, () => {
    const gap = createTrailBuffer(TRAIL.cap, 0);
    pushTrail(gap, 100, 100, 0);
    expect(pushTrail(gap, 140, 100, 0.35)).toBe(1);
    expect(pushTrail(gap, 180, 100, 0.71)).toBe(0);
    expect(gap.count).toBe(1);
    // The chain goes on from the sample that broke it.
    expect(pushTrail(gap, 220, 100, 0.72)).toBe(1);
    expect(segments(gap)[1].slice(0, 4)).toEqual([180, 100, 220, 100]);

    const jump = createTrailBuffer(TRAIL.cap, 0);
    pushTrail(jump, 100, 100, 0);
    expect(pushTrail(jump, 100 + 12 * TRAIL.grid, 100, 0.01)).toBe(1);
    expect(pushTrail(jump, 340 + 13 * TRAIL.grid, 100 + 13 * TRAIL.grid, 0.02)).toBe(0);
    expect(pushTrail(jump, 340, 100 + 13 * TRAIL.grid, 0.03)).toBe(0);
    expect(jump.count).toBe(1);
  });

  it("times are seconds since the epoch; an unusable sample breaks the chain", () => {
    const b = createTrailBuffer(TRAIL.cap, 1000);
    pushTrail(b, 100, 100, 1000.25);
    expect(b.lastT).toBeCloseTo(0.25, 6);
    pushTrail(b, 140, 100, 1000.5);
    expect(segments(b)[0][4]).toBeCloseTo(0.5, 6);

    expect(pushTrail(b, Number.NaN, 100, 1000.51)).toBe(0);
    expect(b.lastX).toBeNaN();
    expect(pushTrail(b, 160, Number.POSITIVE_INFINITY, 1000.52)).toBe(0);
    expect(pushTrail(b, 180, 100, 1000.53)).toBe(0);
    expect(pushTrail(b, 200, 100, 1000.54)).toBe(1);
    expect(segments(b).flat().every(Number.isFinite)).toBe(true);
  });

  it("the ring overwrites the oldest segment and marks everything dirty when it wraps", () => {
    const b = createTrailBuffer(4, 0);
    pushTrail(b, 0, 0, 0);
    for (let i = 1; i <= 4; i += 1) pushTrail(b, i * 20, 0, i * 0.01);
    expect(b.count).toBe(4);
    expect(b.head).toBe(0);
    expect(b.dirty).toEqual([0, 4]);
    pushTrail(b, 100, 0, 0.05);
    expect(b.count).toBe(4);
    expect(b.head).toBe(1);
    expect(b.dirty).toBe("all");
    // Slot 0 held the oldest segment (0 → 20); it now holds the newest.
    expect(segments(b)[0].slice(0, 4)).toEqual([80, 0, 100, 0]);
    // "all" stays "all" until the mesh clears it.
    pushTrail(b, 120, 0, 0.06);
    expect(b.dirty).toBe("all");
  });

  it("dirty is the contiguous range written since the mesh last cleared it", () => {
    const b = createTrailBuffer(4, 0);
    pushTrail(b, 0, 0, 0);
    expect(b.dirty).toBeNull();
    pushTrail(b, 40, 20, 0.01); // an L: slots 0 and 1
    expect(b.dirty).toEqual([0, 2]);
    b.dirty = null;
    pushTrail(b, 60, 20, 0.02); // slot 2
    expect(b.dirty).toEqual([2, 3]);
    pushTrail(b, 80, 20, 0.03); // slot 3, contiguous
    expect(b.dirty).toEqual([2, 4]);
    b.dirty = null;
    pushTrail(b, 100, 20, 0.04); // wraps to slot 0 after a clear: still one range
    expect(b.dirty).toEqual([0, 1]);
    b.dirty = null;
    pushTrail(b, 100, 20, 0.05); // same cell: nothing written
    expect(b.dirty).toBeNull();
    // An L across the seam: slots 3 and 0 in one push.
    const seam = createTrailBuffer(4, 0);
    pushTrail(seam, 0, 0, 0);
    for (let i = 1; i <= 3; i += 1) pushTrail(seam, i * 20, 0, i * 0.01);
    seam.dirty = null;
    expect(pushTrail(seam, 100, 20, 0.04)).toBe(2);
    expect(seam.dirty).toBe("all");
  });
});

describe("attachTiltInput lays the trail for a mouse or a pen only", () => {
  type Listener = (event: Event) => void;

  function makeHost(media: Record<string, boolean>) {
    const listeners = new Map<string, Listener>();
    const host = {
      innerWidth: 1280,
      innerHeight: 800,
      scrollX: 0,
      scrollY: 1000,
      matchMedia: (query: string) => ({ matches: media[query] ?? false }) as MediaQueryList,
      addEventListener: vi.fn((type: string, listener: Listener) => listeners.set(type, listener)),
      removeEventListener: vi.fn((type: string) => listeners.delete(type)),
    };
    return { host: host as unknown as TiltHost, listeners, raw: host };
  }

  const FINE = "(hover: hover) and (pointer: fine)";
  const move = (clientX: number, clientY: number, pointerType: string, timeStamp: number) =>
    ({ clientX, clientY, pointerType, timeStamp }) as unknown as Event;

  it.each(["mouse", "pen"])("%s: document px (client + scroll), event time in seconds", (pointerType) => {
    const fx = createSceneFx();
    fx.trail = createTrailBuffer(TRAIL.cap, 2);
    const { host, listeners } = makeHost({ [FINE]: true });
    const detach = attachTiltInput(fx, host);
    const onMove = listeners.get("pointermove")!;
    onMove(move(100, 100, pointerType, 2100));
    expect([fx.trail.lastX, fx.trail.lastY]).toEqual([100, 1100]);
    expect(fx.trail.lastT).toBeCloseTo(0.1, 6);
    onMove(move(160, 100, pointerType, 2116));
    expect(fx.trail.count).toBe(1);
    expect(Array.from(fx.trail.seg.subarray(0, 4))).toEqual([100, 1100, 160, 1100]);
    // The tilt still follows the same pointer.
    expect(fx.tiltLive).toBe(true);
    detach();
  });

  it("never for touch or an unknown pointer type on a fine-pointer device", () => {
    const fx = createSceneFx();
    const { host, listeners } = makeHost({ [FINE]: true });
    attachTiltInput(fx, host);
    const onMove = listeners.get("pointermove")!;
    for (let i = 0; i < 5; i += 1) {
      onMove(move(100 + i * 40, 100, "touch", 1000 + i * 16));
      onMove(move(100 + i * 40, 100, "", 1000 + i * 16));
    }
    expect(fx.trail.lastX).toBeNaN();
    expect(fx.trail.count).toBe(0);
  });

  it("never on a coarse pointer: no pointer listener exists at all", () => {
    const fx = createSceneFx();
    const { host, listeners, raw } = makeHost({ "(pointer: coarse)": true });
    attachTiltInput(fx, host);
    expect(listeners.has("pointermove")).toBe(false);
    expect(raw.addEventListener).not.toHaveBeenCalledWith("pointermove", expect.anything(), expect.anything());
    expect(fx.trail.count).toBe(0);
  });

  it("the fx carries a trail buffer of TRAIL.cap on the page's clock", () => {
    vi.spyOn(performance, "now").mockReturnValue(12_345);
    const fx = createSceneFx();
    expect(fx.trail.seg.length).toBe(TRAIL.cap * TRAIL_STRIDE);
    expect(fx.trail.epoch).toBeCloseTo(12.345, 9);
    expect(fx.trail.dirty).toBeNull();
  });
});

describe("createTrailMesh — one P5 ribbon in document px", () => {
  const PALETTE = pickSceneRoles({
    cyan: "#4fc3e8",
    blue: "#3970ff",
    redLift: "#ff5362",
    txt: "#f6f7fb",
    bg: "#0a0b10",
  });

  const liveProbe = () => {
    const probe = createScrollProbe();
    probe.live = true;
    probe.headerH = 64;
    probe.stage = { top: 0, bottom: 5000 };
    return probe;
  };

  const attr = (mesh: ReturnType<typeof createTrailMesh>["mesh"], name: string) =>
    mesh.geometry.getAttribute(name) as BufferAttribute;

  it(`holds TRAIL.cap × ${TRAIL_VERTICES} vertices, draws last, never culled, on the trail branch of P5`, () => {
    const trail = createTrailMesh(PALETTE);
    const { mesh } = trail;
    expect(mesh.name).toBe("scene-trail");
    expect(mesh.geometry.index).toBeNull();
    for (const name of ["position", "normal", "uv", "aTag"]) {
      expect(attr(mesh, name).count, name).toBe(TRAIL.cap * TRAIL_VERTICES);
    }
    for (const name of ["position", "normal", "aTag"]) expect(attr(mesh, name).usage, name).toBe(DynamicDrawUsage);
    expect(mesh.frustumCulled).toBe(false);
    expect(mesh.renderOrder).toBe(TRAIL_RENDER_ORDER);
    expect(mesh.visible).toBe(false);
    const material = mesh.material as unknown as { uniforms: TubeUniforms; fragmentShader: string; depthTest: boolean };
    expect(material.uniforms.uMode.value).toBe(TUBE_MODE.trail);
    expect(material.depthTest).toBe(false);
    // The shader's life literal is TRAIL.life, and the hub links keep their own branch.
    expect(material.fragmentShader).toContain(`(uTime - vTag) / ${TRAIL.life.toFixed(2)}`);
    expect(material.fragmentShader).toContain("uMode < 3.5");
    trail.dispose();
  });

  it("uploads only the slots written, the whole buffer after a wrap, and never cuts a pending full upload short", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const trail = createTrailMesh(PALETTE);
    const position = attr(trail.mesh, "position");
    const normal = attr(trail.mesh, "normal");
    const tag = attr(trail.mesh, "aTag");
    const buffer = createTrailBuffer(TRAIL.cap, 0);
    const frame = { trail: buffer, scrollY: 0, probe: liveProbe(), w: 1280, h: 800, ink: false };

    pushTrail(buffer, 100, 100, 0.9);
    pushTrail(buffer, 160, 140, 0.95); // an L: slots 0, 1
    const version = position.version;
    trail.update(frame);
    expect(buffer.dirty).toBeNull();
    expect(position.version).toBe(version + 1);
    expect(position.updateRanges).toEqual([{ start: 0, count: 2 * TRAIL_VERTICES * 3 }]);
    expect(normal.updateRanges).toEqual([{ start: 0, count: 2 * TRAIL_VERTICES * 3 }]);
    expect(tag.updateRanges).toEqual([{ start: 0, count: 2 * TRAIL_VERTICES }]);
    expect(trail.mesh.geometry.drawRange.count).toBe(2 * TRAIL_VERTICES);
    expect(trail.mesh.visible).toBe(true);
    // Slot 0 is (100,100) → (160,100): six vertices at its ends, born at 0.95.
    expect(Array.from((position.array as Float32Array).subarray(0, 18))).toEqual([
      100, 100, 0, 160, 100, 0, 160, 100, 0, 100, 100, 0, 160, 100, 0, 100, 100, 0,
    ]);
    expect(Array.from((tag.array as Float32Array).subarray(0, 12)).every((t) => Math.abs(t - 0.95) < 1e-6)).toBe(true);

    // A frame with nothing new uploads nothing.
    trail.update(frame);
    expect(position.version).toBe(version + 1);

    pushTrail(buffer, 200, 140, 1); // slot 2
    trail.update(frame);
    expect(position.updateRanges).toEqual([
      { start: 0, count: 2 * TRAIL_VERTICES * 3 },
      { start: 2 * TRAIL_VERTICES * 3, count: TRAIL_VERTICES * 3 },
    ]);
    // What the renderer does once it has uploaded them.
    for (const a of [position, normal, tag]) {
      a.clearUpdateRanges();
      a.onUploadCallback();
    }

    // Round the ring within one frame: one full upload.
    for (let i = 0; i < TRAIL.cap; i += 1) pushTrail(buffer, 220 + i * 20, 140, 1);
    expect(buffer.dirty).toBe("all");
    trail.update(frame);
    expect(position.updateRanges).toEqual([]);
    expect(tag.updateRanges).toEqual([]);
    expect(trail.mesh.geometry.drawRange.count).toBe(TRAIL.cap * TRAIL_VERTICES);
    // More writes before that upload happened must not turn it into a partial one…
    pushTrail(buffer, 220 + TRAIL.cap * 20, 140, 1);
    trail.update(frame);
    expect(position.updateRanges).toEqual([]);
    // …after it, they are ranges again.
    for (const a of [position, normal, tag]) a.onUploadCallback();
    pushTrail(buffer, 240 + TRAIL.cap * 20, 140, 1);
    trail.update(frame);
    expect(position.updateRanges).toHaveLength(1);

    // Everything has faded: no draw at all.
    now.mockReturnValue(1000 + (1 + TRAIL.life) * 1000);
    trail.update(frame);
    expect(trail.mesh.visible).toBe(false);
    trail.dispose();
  });

  it("sits on the page like fitAnchor places a host, and faces the camera", () => {
    vi.spyOn(performance, "now").mockReturnValue(500);
    const trail = createTrailMesh(PALETTE);
    const buffer = createTrailBuffer(TRAIL.cap, 0);
    pushTrail(buffer, 100, 1000, 0.4);
    pushTrail(buffer, 140, 1000, 0.45);
    const probe = liveProbe();
    const [w, h, scrollY] = [1280, 800, 700];
    trail.update({ trail: buffer, scrollY, probe, w, h, ink: false });

    const k = worldPerPx(h);
    const top = scrollY + probe.headerH; // stuck under the header (canvasDocTop)
    expect(trail.mesh.scale.toArray()).toEqual([k, -k, 1]);
    expect(trail.mesh.position.x).toBeCloseTo((-w / 2) * k, 12);
    expect(trail.mesh.position.y).toBeCloseTo((top + h / 2) * k, 12);
    trail.mesh.updateMatrixWorld(true);
    const [docX, docY] = [900, 1100];
    const world = new Vector3(docX, docY, 0).applyMatrix4(trail.mesh.matrixWorld);
    const host = fitAnchor(w, h, docX, docY - top, 100, 1, 1);
    expect(world.x).toBeCloseTo(host.x, 9);
    expect(world.y).toBeCloseTo(host.y, 9);
    expect(world.z).toBeCloseTo(0, 12);

    // Mirrored y: three flips the front face, so the triangles must be counter-clockwise in doc px.
    expect(trail.mesh.matrixWorld.determinant()).toBeLessThan(0);
    const u = (trail.mesh.material as unknown as { uniforms: TubeUniforms }).uniforms;
    const p = attr(trail.mesh, "position").array;
    const n = attr(trail.mesh, "normal").array;
    const corner = (v: number) => [p[v * 3] + n[v * 3] * u.uWidth.value, p[v * 3 + 1] + n[v * 3 + 1] * u.uWidth.value];
    for (const first of [0, 3]) {
      const [a, b, c] = [corner(first), corner(first + 1), corner(first + 2)];
      expect((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])).toBeGreaterThan(0);
    }
    // The ribbon is exactly uWidth CSS px wide.
    expect(Math.abs(corner(2)[1] - corner(0)[1])).toBeCloseTo(TRAIL.widthPx.glow, 6);
    expect(u.uTime.value).toBeCloseTo(0.5, 9);
    trail.dispose();
  });

  it("glow adds light; ink is narrower, fainter and composited over the page", () => {
    vi.spyOn(performance, "now").mockReturnValue(100);
    const trail = createTrailMesh(PALETTE);
    const material = trail.mesh.material as unknown as { uniforms: TubeUniforms; blendDst: number };
    expect(material.uniforms.uInk.value).toBe(0);
    expect(material.blendDst).toBe(OneFactor);
    expect(material.uniforms.uColorA.value.equals(toColor(PALETTE.blue))).toBe(true);
    expect(material.uniforms.uColorB.value.equals(toColor(PALETTE.cyan))).toBe(true);
    expect(material.uniforms.uHot.value.equals(toColor(PALETTE.red))).toBe(true);

    const buffer = createTrailBuffer(TRAIL.cap, 0);
    pushTrail(buffer, 0, 0, 0.05);
    pushTrail(buffer, 20, 0, 0.06);
    const frame = { trail: buffer, scrollY: 0, probe: createScrollProbe(), w: 390, h: 780, ink: false };
    trail.update(frame);
    expect(material.uniforms.uWidth.value).toBe(TRAIL.widthPx.glow);
    expect(material.uniforms.uAlpha.value).toBe(TRAIL_ALPHA.glow);

    const light = { ...PALETTE, mode: "ink" as const };
    trail.setPalette(light);
    trail.update({ ...frame, ink: true });
    expect(material.uniforms.uInk.value).toBe(1);
    expect(material.blendDst).toBe(OneMinusSrcAlphaFactor);
    expect(material.uniforms.uWidth.value).toBe(TRAIL.widthPx.ink);
    expect(material.uniforms.uAlpha.value).toBe(TRAIL_ALPHA.ink);
    // Before the director has measured, the canvas counts as stuck to the viewport top.
    expect(trail.mesh.position.y).toBeCloseTo((0 + 780 / 2) * worldPerPx(780), 12);
    trail.dispose();
  });
});
