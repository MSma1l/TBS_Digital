import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Curve,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  Points,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
  type ShaderMaterial,
} from "three";
import { HELIX, HELIX_ANGLE, MODEL_RADIUS, type Vec3 } from "@/components/scene/shapes";
import { HELIX_REACH } from "@/components/scene/choreography";
import { SCENE_TIER_CONFIG, type SceneCanvasTier } from "@/components/scene/tiers";
import { LINE_MODE, SURFACE_MODE, TUBE_MODE, toColor } from "@/components/scene/three/materials";
import { pickSceneRoles } from "@/components/scene/three/palette";
import {
  HELIX_PARTS,
  helixChips,
  helixRungs,
  helixSamples,
  helixStrandPoint,
  helixStrandTangent,
  type HelixSegment,
} from "@/components/scene/three/samples";
import {
  HELIX_ACCENT_SECONDS,
  HELIX_AMBIENT_ROLL,
  HELIX_ANGLE as MODEL_HELIX_ANGLE,
  HELIX_ARRIVE,
  HELIX_BIT,
  HELIX_EXIT,
  HELIX_GLITCH_SECONDS,
  HELIX_HOLOGRAM,
  createHelixModel,
  helixArrivePose,
  helixBitStrokes,
  helixDim,
  helixExitPose,
  helixFrontFlare,
  helixLandingMatrix,
  helixRungSweep,
  layoutHelixHologram,
  type HelixFrame,
  type HelixModel,
} from "@/components/scene/three/models/helix";

/*
 * The Work DNA helix (three/models/helix.ts) and the swarm's slot 0 that lands on it
 * (three/samples.ts `helixSamples`): the draws each tier builds, the geometry of every part —
 * strands, chips, rungs with square nodes, seven-segment bits, no sprite anywhere — and how the
 * model turns, lies down, recolours, glitches and dissolves. three.js runs in jsdom for
 * everything but a WebGL context (the shaders compile in the lab, not here).
 */

const PALETTE = pickSceneRoles({
  cyan: "#4fc3e8",
  blue: "#3970ff",
  redLift: "#ff5362",
  txt: "#f6f7fb",
  bg: "#0a0b10",
});

const frame = (over: Partial<HelixFrame> = {}): HelixFrame => ({
  time: 0,
  step: 0,
  focus: 0,
  reveal: 1,
  tx: 0,
  ty: 0,
  prewarm: false,
  halfHeightPx: 400,
  dpr: 1,
  ...over,
});

const TIERS: SceneCanvasTier[] = ["high", "mid"];
const EPS = 1e-5;

type Parts = {
  strands: Mesh;
  chips: InstancedMesh;
  rungs: LineSegments;
  bits: LineSegments;
  hologram: Mesh;
};

function parts(model: HelixModel): Parts {
  const [strands, chips, rungs, bits, hologram] = model.objects;
  return {
    strands: strands as Mesh,
    chips: chips as InstancedMesh,
    rungs: rungs as LineSegments,
    bits: bits as LineSegments,
    hologram: hologram as Mesh,
  };
}

const uniforms = (object: Object3D) => ((object as Mesh).material as ShaderMaterial).uniforms;
const length3 = (v: readonly number[]) => Math.hypot(v[0], v[1], v[2]);
const dot3 = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub3 = (a: readonly number[], b: readonly number[]): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

function distanceToSegment(p: Vec3, { a, b }: HelixSegment): number {
  const ab = sub3(b, a);
  const t = Math.min(1, Math.max(0, dot3(sub3(p, a), ab) / dot3(ab, ab)));
  return length3(sub3(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]));
}

describe("helix model — draws per tier", () => {
  for (const tier of TIERS) {
    const config = SCENE_TIER_CONFIG[tier];

    it(`${tier}: five draws on existing programs — strands (P5 links), chips (P3 edges), rungs (P4 synapse), bits (P4 bits), hologram (P2 holo)`, () => {
      const model = createHelixModel(config, PALETTE);
      const { strands, chips, rungs, bits, hologram } = parts(model);
      expect(model.objects).toHaveLength(5);
      expect(strands).toBeInstanceOf(Mesh);
      expect(uniforms(strands).uMode.value).toBe(TUBE_MODE.links);
      expect(chips).toBeInstanceOf(InstancedMesh);
      expect(chips.count).toBe(config.helixChips);
      expect(chips.instanceColor).not.toBeNull();
      expect(uniforms(chips).uMode.value).toBe(SURFACE_MODE.edges);
      expect(rungs).toBeInstanceOf(LineSegments);
      expect(uniforms(rungs).uMode.value).toBe(LINE_MODE.synapse);
      expect(bits).toBeInstanceOf(LineSegments);
      expect(uniforms(bits).uMode.value).toBe(LINE_MODE.bits);
      expect(hologram).toBeInstanceOf(Mesh);
      expect(uniforms(hologram).uMode.value).toBe(SURFACE_MODE.holo);
      // Every draw lives under the placed group; no sprite anywhere (squares and strokes only).
      const found: Object3D[] = [];
      model.group.traverse((object) => {
        if (object instanceof Points) found.push(object);
        if (object instanceof Mesh || object instanceof LineSegments) expect(model.objects).toContain(object);
      });
      expect(found).toEqual([]);
      for (const object of model.objects) {
        let root: Object3D = object;
        while (root.parent) root = root.parent;
        expect(root).toBe(model.group);
        expect(object.frustumCulled).toBe(false);
      }
      model.dispose();
    });

    it(`${tier}: strands ${config.helixTube.join("×")} per tube, rungs ${config.helixRungs}×10 segments, bits ${config.helixBits}×6 segments`, () => {
      const model = createHelixModel(config, PALETTE);
      const { strands, rungs, bits } = parts(model);
      const [along, around] = config.helixTube;
      const strandGeometry = strands.geometry as BufferGeometry;
      expect(strandGeometry.getAttribute("position").count).toBe(2 * along * around * 6);
      const tags = new Set(Array.from(strandGeometry.getAttribute("aTag").array as Float32Array));
      // A outgoing (packets climb), B incoming (packets run down, hot).
      expect([...tags].sort()).toEqual([0, 1.5]);
      expect(rungs.geometry.getAttribute("position").count / 2).toBe(config.helixRungs * 10);
      expect(bits.geometry.getAttribute("position").count / 2).toBe(config.helixBits * 6);
      model.dispose();
    });
  }

  it("the tiers: 160×4 / 100×3 tubes, 80 / 52 chips, 22 / 14 rungs, 36 / 20 bits", () => {
    const { high, mid } = SCENE_TIER_CONFIG;
    expect([high.helixTube, high.helixChips, high.helixRungs, high.helixBits]).toEqual([[160, 4], 80, 22, 36]);
    expect([mid.helixTube, mid.helixChips, mid.helixRungs, mid.helixBits]).toEqual([[100, 3], 52, 14, 20]);
  });
});

describe("helix model — geometry", () => {
  it("every part lies within HELIX_REACH of the axis: choreography.ts sizes the lying ambient helix by it to keep it in its band", () => {
    const chip = HELIX_PARTS.chip;
    // A strand's tube, a chip riding on it (lifted, its box's half diagonal across the strand), a bit glyph.
    expect(HELIX.radius + HELIX_PARTS.tube).toBeLessThanOrEqual(HELIX_REACH);
    expect(HELIX.radius + chip.lift + Math.hypot(chip.width, chip.thickness) / 2).toBeLessThanOrEqual(HELIX_REACH);
    expect(HELIX_BIT.radius[1] + Math.hypot(HELIX_BIT.width, HELIX_BIT.height) / 2).toBeLessThanOrEqual(HELIX_REACH);
  });

  it("HELIX_ANGLE is the model's, the layout's and shapes.ts's one card step", () => {
    expect(MODEL_HELIX_ANGLE).toBe(HELIX_ANGLE);
    expect(HELIX_ANGLE).toBeCloseTo((2 * Math.PI) / 9, 12);
  });

  it("strands: right-handed, half a turn apart, HELIX.turns turns over HELIX.height; unit tangents", () => {
    for (const strand of [0, 1]) {
      const bottom = helixStrandPoint(strand, 0);
      const top = helixStrandPoint(strand, 1);
      expect(bottom[1]).toBeCloseTo(-HELIX.height / 2, 12);
      expect(top[1]).toBeCloseTo(HELIX.height / 2, 12);
      for (let i = 0; i <= 40; i += 1) {
        const p = helixStrandPoint(strand, i / 40);
        expect(Math.hypot(p[0], p[2])).toBeCloseTo(HELIX.radius, 12);
        const t = helixStrandTangent(strand, i / 40);
        expect(length3(t)).toBeCloseTo(1, 12);
        // Numerical derivative agrees.
        const q = helixStrandPoint(strand, i / 40 + 1e-6);
        const d = sub3(q, p);
        expect(dot3(d, t) / length3(d)).toBeCloseTo(1, 6);
      }
    }
    const a = helixStrandPoint(0, 0.3);
    const b = helixStrandPoint(1, 0.3);
    expect(a[0]).toBeCloseTo(-b[0], 12);
    expect(a[2]).toBeCloseTo(-b[2], 12);
    // Right-handed about +y: (T × dT/dt) · y > 0 is the curvature's sense — check (p × p') · y < 0
    // for x = R·sin, z = R·cos (a quarter turn later the point is at +x from +z).
    const p0 = helixStrandPoint(0, 0);
    const p1 = helixStrandPoint(0, 1 / (4 * HELIX.turns));
    expect(p0[2]).toBeCloseTo(HELIX.radius, 12);
    expect(p1[0]).toBeCloseTo(HELIX.radius, 12);
    expect(p1[1]).toBeGreaterThan(p0[1]);
  });

  it("TubeGeometry's frames along a strand never flip or twist abruptly (checked on three's own Frenet frames)", () => {
    class Strand extends Curve<Vector3> {
      constructor() {
        super();
      }
      override getPoint(t: number, target: Vector3 = new Vector3()): Vector3 {
        const [x, y, z] = helixStrandPoint(0, t);
        return target.set(x, y, z);
      }
    }
    for (const segments of [SCENE_TIER_CONFIG.high.helixTube[0], SCENE_TIER_CONFIG.mid.helixTube[0]]) {
      const { tangents, normals, binormals } = new Strand().computeFrenetFrames(segments, false);
      for (let i = 0; i <= segments; i += 1) {
        expect(Math.abs(tangents[i].dot(normals[i]))).toBeLessThan(1e-6);
        expect(Math.abs(binormals[i].dot(normals[i]))).toBeLessThan(1e-6);
        if (i > 0) {
          expect(normals[i].dot(normals[i - 1])).toBeGreaterThan(0.98);
          expect(binormals[i].dot(binormals[i - 1])).toBeGreaterThan(0.98);
        }
      }
    }
  });

  it("the strands' tube vertices sit 0.012 from their centre line", () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.mid, PALETTE);
    const position = parts(model).strands.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i += 7) {
      const p: Vec3 = [position.getX(i), position.getY(i), position.getZ(i)];
      const t = p[1] / HELIX.height + 0.5;
      // The nearest strand point is within a few tube radii of this height (the tube is thin).
      let best = Infinity;
      for (const strand of [0, 1]) {
        for (let k = -20; k <= 20; k += 1) {
          best = Math.min(best, length3(sub3(p, helixStrandPoint(strand, t + k * 2e-4))));
        }
      }
      expect(best).toBeLessThan(HELIX_PARTS.tube * 1.05);
      expect(best).toBeGreaterThan(HELIX_PARTS.tube * 0.85);
    }
    model.dispose();
  });

  it("chips: 0.16 × 0.09 × 0.03 boxes laid along their strand (x the tangent, z out from the axis), on both strands", () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.high, PALETTE);
    const { chips } = parts(model);
    // A unit box (the edges shader reads its ±0.5 coordinates), sized per instance.
    const box = chips.geometry as BoxGeometry;
    expect([box.parameters.width, box.parameters.height, box.parameters.depth]).toEqual([1, 1, 1]);
    expect([HELIX_PARTS.chip.length, HELIX_PARTS.chip.width, HELIX_PARTS.chip.thickness]).toEqual([0.16, 0.09, 0.03]);
    const list = helixChips(SCENE_TIER_CONFIG.high.helixChips);
    expect(list.filter((chip) => chip.strand === 0)).toHaveLength(40);
    expect(list.filter((chip) => chip.strand === 1)).toHaveLength(40);
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    list.forEach((chip, i) => {
      chips.getMatrixAt(i, matrix);
      matrix.decompose(position, rotation, scale);
      // Sized by the matrix (float32), right-handed (a mirror would decompose to a negative x).
      expect(scale.x).toBeCloseTo(HELIX_PARTS.chip.length, 6);
      expect(scale.y).toBeCloseTo(HELIX_PARTS.chip.width, 6);
      expect(scale.z).toBeCloseTo(HELIX_PARTS.chip.thickness, 6);
      const x = new Vector3(1, 0, 0).applyQuaternion(rotation);
      const z = new Vector3(0, 0, 1).applyQuaternion(rotation);
      const tangent = helixStrandTangent(chip.strand, chip.t);
      expect(x.dot(new Vector3(...tangent))).toBeCloseTo(1, 6);
      expect(z.y).toBeCloseTo(0, 6);
      // Centred just outside its strand, facing out.
      const on = helixStrandPoint(chip.strand, chip.t);
      expect(position.distanceTo(new Vector3(...on))).toBeCloseTo(HELIX_PARTS.chip.lift, 6);
      expect(z.dot(new Vector3(on[0], 0, on[2]).normalize())).toBeCloseTo(1, 6);
      expect(chip.t).toBeGreaterThan(0);
      expect(chip.t).toBeLessThan(1);
    });
    model.dispose();
  });

  it("rungs: two halves per base pair with a gap at the axis, a SQUARE node outline at each half's inner end", () => {
    for (const tier of TIERS) {
      const count = SCENE_TIER_CONFIG[tier].helixRungs;
      const model = createHelixModel(SCENE_TIER_CONFIG[tier], PALETTE);
      const geometry = parts(model).rungs.geometry;
      const position = geometry.getAttribute("position");
      const u = geometry.getAttribute("aU");
      const phase = geometry.getAttribute("aPhase");
      const rungs = helixRungs(count);
      expect(rungs).toHaveLength(count);
      let v = 0;
      rungs.forEach((rung, r) => {
        expect(rung.t).toBeCloseTo((r + 0.5) / count, 12);
        expect(rung.halves.map((half) => half.strand)).toEqual([0, 1]);
        const inner: Vec3[] = [];
        for (const half of rung.halves) {
          // The half: from just inside its strand, straight towards the axis, level.
          const strand = helixStrandPoint(half.strand, rung.t);
          expect(length3(sub3(half.line.a, strand))).toBeCloseTo(HELIX_PARTS.inset, 9);
          expect(half.line.a[1]).toBeCloseTo(half.line.b[1], 12);
          expect(Math.hypot(half.line.b[0], half.line.b[2])).toBeCloseTo(HELIX_PARTS.gap + 2 * HELIX_PARTS.node, 12);
          // The node: four equal sides, a closed loop, right angles — a square, never a dot.
          expect(half.node).toHaveLength(4);
          half.node.forEach((side, k) => {
            expect(length3(sub3(side.b, side.a))).toBeCloseTo(2 * HELIX_PARTS.node, 12);
            const next = half.node[(k + 1) % 4];
            expect(length3(sub3(side.b, next.a))).toBeLessThan(1e-12);
            expect(Math.abs(dot3(sub3(side.b, side.a), sub3(next.b, next.a)))).toBeLessThan(1e-12);
          });
          // The line ends on the node's outer side, at its middle.
          expect(Math.min(...half.node.map((side) => distanceToSegment(half.line.b, side)))).toBeLessThan(1e-12);
          inner.push(half.node[0].a);
          // The buffer draws exactly this: the line (u 0 → 1), then the four sides (u 1), phase = rung.
          const segments = [half.line, ...half.node];
          segments.forEach((segment, k) => {
            for (const [end, point] of [
              [0, segment.a],
              [1, segment.b],
            ] as const) {
              expect(position.getX(v)).toBeCloseTo(point[0], 6);
              expect(position.getY(v)).toBeCloseTo(point[1], 6);
              expect(position.getZ(v)).toBeCloseTo(point[2], 6);
              expect(u.getX(v)).toBe(k === 0 ? end : 1);
              expect(phase.getX(v)).toBe(r);
              v += 1;
            }
          });
        }
        // The gap: the two nodes' inner sides are 2·gap apart, across the axis.
        expect(Math.hypot(inner[0][0] - inner[1][0], inner[0][2] - inner[1][2])).toBeCloseTo(2 * HELIX_PARTS.gap, 12);
      });
      expect(v).toBe(position.count);
      model.dispose();
    }
  });

  it("bits: a seven-segment 0 is four strokes and a 1 two, axis-aligned, joints broken, drawn per slot around the axis", () => {
    const zero = helixBitStrokes(0);
    const one = helixBitStrokes(1);
    expect(zero).toHaveLength(4);
    expect(one).toHaveLength(2);
    for (const strokes of [zero, one]) {
      const ends: Array<[number, number]> = [];
      for (const [x0, y0, x1, y1] of strokes) {
        expect((x0 === x1) !== (y0 === y1)).toBe(true);
        expect(Math.hypot(x1 - x0, y1 - y0)).toBeGreaterThan(HELIX_BIT.joint);
        expect(Math.max(Math.abs(x0), Math.abs(x1))).toBeLessThanOrEqual(HELIX_BIT.width / 2 + 1e-12);
        expect(Math.max(Math.abs(y0), Math.abs(y1))).toBeLessThanOrEqual(HELIX_BIT.height / 2 + 1e-12);
        ends.push([x0, y0], [x1, y1]);
      }
      // No two strokes meet: every joint is a break.
      for (let i = 0; i < ends.length; i += 1) {
        for (let j = i + 1; j < ends.length; j += 1) {
          if (Math.floor(i / 2) === Math.floor(j / 2)) continue;
          expect(Math.hypot(ends[i][0] - ends[j][0], ends[i][1] - ends[j][1])).toBeGreaterThan(HELIX_BIT.joint / 2);
        }
      }
    }

    const config = SCENE_TIER_CONFIG.high;
    const model = createHelixModel(config, PALETTE);
    const geometry = parts(model).bits.geometry;
    const position = geometry.getAttribute("position");
    const glyph = geometry.getAttribute("aGlyph");
    const kind = geometry.getAttribute("aU");
    const seed = geometry.getAttribute("aPhase");
    expect(uniforms(parts(model).bits).uSpan.value).toBe(HELIX.height);
    for (let slot = 0; slot < config.helixBits; slot += 1) {
      const base = slot * 12;
      const radius = Math.hypot(position.getX(base), position.getZ(base));
      expect(radius).toBeGreaterThanOrEqual(HELIX_BIT.radius[0]);
      expect(radius).toBeLessThanOrEqual(HELIX_BIT.radius[1]);
      [...zero, ...one].forEach(([x0, y0, x1, y1], k) => {
        for (let e = 0; e < 2; e += 1) {
          const i = base + k * 2 + e;
          expect(position.getX(i)).toBe(position.getX(base));
          expect(position.getY(i)).toBe(0);
          expect(position.getZ(i)).toBe(position.getZ(base));
          expect(glyph.getX(i)).toBeCloseTo(e === 0 ? x0 : x1, 6);
          expect(glyph.getY(i)).toBeCloseTo(e === 0 ? y0 : y1, 6);
          expect(kind.getX(i)).toBe(k < 4 ? 0 : 1);
          expect(seed.getX(i)).toBe(seed.getX(base));
        }
      });
      expect(seed.getX(base)).toBeGreaterThanOrEqual(0);
      expect(seed.getX(base)).toBeLessThan(1);
    }
    model.dispose();
  });

  it("the hologram: a 1.6 × 1.0 plane beside the helix (clear of the strands), hung off the group, not the turning pivot", () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.high, PALETTE);
    const { hologram } = parts(model);
    const box = (hologram.geometry as BufferGeometry & { parameters: { width: number; height: number } }).parameters;
    expect([box.width, box.height]).toEqual([1.6, 1]);
    expect(hologram.parent).toBe(model.group);
    expect(hologram.name).toBe(HELIX_HOLOGRAM.name);
    expect(HELIX_HOLOGRAM.x - HELIX_HOLOGRAM.width / 2).toBeGreaterThan(HELIX.radius + HELIX_PARTS.chip.lift + 0.1);
    // Laid out from px: 537.6px right, 36px up, 435.2px wide at 121.5px per unit.
    layoutHelixHologram(model.group, 537.6, 36, 435.2, 121.5);
    expect(hologram.position.x).toBeCloseTo(537.6 / 121.5, 12);
    expect(hologram.position.y).toBeCloseTo(36 / 121.5, 12);
    expect(hologram.scale.x * HELIX_HOLOGRAM.width * 121.5).toBeCloseTo(435.2, 9);
    expect(hologram.scale.y).toBe(hologram.scale.x);
    const before = hologram.position.clone();
    layoutHelixHologram(model.group, 1, 1, 100, 0);
    layoutHelixHologram(model.group, 1, 1, Number.NaN, 100);
    expect(hologram.position.equals(before)).toBe(true);
    model.dispose();
  });
});

describe("helix model — behaviour", () => {
  it("update turns the strands by −focus·HELIX_ANGLE (plus a small tilt); the hologram keeps facing the viewer", () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.mid, PALETTE);
    const { strands, hologram } = parts(model);
    model.update(frame({ focus: 2.5 }));
    expect(strands.parent!.rotation.y).toBeCloseTo(-2.5 * HELIX_ANGLE, 12);
    model.group.updateMatrixWorld(true);
    const facing = new Vector3(0, 0, 1).transformDirection(hologram.matrixWorld);
    expect(facing.z).toBeCloseTo(1, 12);
    model.update(frame({ focus: 2.5, tx: 1, ty: -1 }));
    model.group.updateMatrixWorld(true);
    const tilted = new Vector3(0, 0, 1).transformDirection(hologram.matrixWorld);
    expect(tilted.z).toBeLessThan(1);
    expect(tilted.z).toBeGreaterThan(0.95);
    // A tilt never turns the helix itself by more than a fraction of a card step.
    const axis = new Vector3(0, 1, 0).transformDirection(strands.matrixWorld);
    expect(axis.y).toBeGreaterThan(Math.cos(0.15));
    model.dispose();
  });

  it("the chips at the front brighten, and follow the turn", () => {
    expect(helixFrontFlare(0, 0.92, 0)).toBe(1);
    expect(helixFrontFlare(0, -0.92, 0)).toBe(0);
    expect(helixFrontFlare(0.92, 0, -Math.PI / 2)).toBeCloseTo(1, 12);
    const model = createHelixModel(SCENE_TIER_CONFIG.high, PALETTE);
    const { chips } = parts(model);
    const list = helixChips(SCENE_TIER_CONFIG.high.helixChips);
    const brightness = (i: number) => chips.instanceColor!.getX(i);
    const front = list.findIndex((chip) => chip.centre[2] > 0.85);
    const back = list.findIndex((chip) => chip.centre[2] < -0.85);
    model.update(frame({ focus: 0 }));
    expect(brightness(front)).toBeGreaterThan(2);
    expect(brightness(back)).toBeCloseTo(1, 9);
    const version = chips.instanceColor!.version;
    model.update(frame({ focus: 0, time: 1 }));
    // Unchanged turn: no colour upload.
    expect(chips.instanceColor!.version).toBe(version);
    model.update(frame({ focus: 9 / 2, time: 2 }));
    expect(chips.instanceColor!.version).toBeGreaterThan(version);
    expect(brightness(front)).toBeCloseTo(1, 9);
    expect(brightness(back)).toBeGreaterThan(2);
    model.dispose();
  });

  it("setMode: ambient lies the helix along x and hides the hologram; spiral stands it up again", () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.mid, PALETTE);
    const { strands, hologram } = parts(model);
    const texture = new CanvasTexture(document.createElement("canvas"));
    model.setHologram(texture);
    model.update(frame());
    expect(hologram.visible).toBe(true);
    const axis = () => {
      model.group.updateMatrixWorld(true);
      return new Vector3(0, 1, 0).transformDirection(strands.matrixWorld);
    };
    expect(axis().y).toBeCloseTo(1, 12);
    model.setMode("ambient");
    expect(HELIX_AMBIENT_ROLL).toBe(Math.PI / 2);
    expect(hologram.visible).toBe(false);
    model.update(frame({ focus: 1 }));
    expect(hologram.visible).toBe(false);
    expect(Math.abs(axis().x)).toBeCloseTo(1, 12);
    model.setMode("spiral");
    model.update(frame({ focus: 1 }));
    expect(axis().y).toBeCloseTo(1, 12);
    expect(hologram.visible).toBe(true);
    // The swarm's landing matrix follows: upright samples land along the helix as it is drawn.
    model.group.position.set(1, 2, 0);
    model.group.scale.setScalar(0.5);
    model.group.updateMatrixWorld(true);
    const landing = new Matrix4();
    const tip = new Vector3(0, HELIX.height / 2, 0);
    const upright = tip.clone().applyMatrix4(helixLandingMatrix(model.group, "spiral", landing));
    expect(upright.distanceTo(new Vector3(1, 2 + HELIX.height / 4, 0))).toBeLessThan(1e-9);
    model.setMode("ambient");
    model.update(frame({ focus: 0 }));
    model.group.updateMatrixWorld(true);
    const lying = tip.clone().applyMatrix4(helixLandingMatrix(model.group, "ambient", landing));
    const drawn = new Vector3(0, HELIX.height / 2, 0).applyMatrix4(strands.matrixWorld);
    expect(lying.distanceTo(drawn)).toBeLessThan(1e-9);
    expect(lying.x).toBeCloseTo(1 - HELIX.height / 4, 9);
    model.setMode("spiral");
    // No texture: nothing to show.
    model.setHologram(null);
    expect(hologram.visible).toBe(false);
    model.dispose();
    texture.dispose();
  });

  it("reveal 0 hides the whole helix unless pre-warming; every material dissolves on the same reveal", () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.mid, PALETTE);
    model.update(frame({ reveal: 0 }));
    expect(model.group.visible).toBe(false);
    model.update(frame({ reveal: 0, prewarm: true }));
    expect(model.group.visible).toBe(true);
    // Pre-warming uploads the hologram's buffers too (every fragment discards at reveal 0).
    expect(parts(model).hologram.visible).toBe(true);
    for (const object of model.objects) expect(uniforms(object).uReveal.value).toBe(0);
    model.update(frame({ reveal: 0.4 }));
    expect(model.group.visible).toBe(true);
    for (const object of model.objects) expect(uniforms(object).uReveal.value).toBe(0.4);
    model.dispose();
  });

  it("dim multiplies every draw's uIntensity, the hologram's glow base included (absent or not finite: 1; clamped to 0..1)", () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.mid, PALETTE);
    const intensities = () => model.objects.map((object) => uniforms(object).uIntensity.value as number);
    model.update(frame());
    expect(intensities()).toEqual([1, 1, 1, 1, 1]);
    // The ambient helix behind Work's heading: CORE_BEHIND_COPY_DIM.narrow's glow value.
    model.update(frame({ dim: 0.55, time: 0.1, focus: 1 }));
    expect(intensities()).toEqual([0.55, 0.55, 0.55, 0.55, 0.55]);
    model.update(frame({ dim: 0.4, time: 0.2 }));
    expect(intensities()).toEqual([0.4, 0.4, 0.4, 0.4, 0.4]);
    // The accent and the flares never touch it.
    model.setAccent(new Color("#ff2d78"));
    model.update(frame({ dim: 0.4, time: 0.3, focus: 3 }));
    expect(intensities().slice(0, 4)).toEqual([0.4, 0.4, 0.4, 0.4]);
    // A swap's flare lifts each draw over the dim by its own share, and decays away again.
    model.glitch();
    model.update(frame({ dim: 0.4, time: 0.35, focus: 3 }));
    const flared = intensities();
    for (let i = 0; i < 4; i += 1) expect(flared[i]).toBeGreaterThan(0.4);
    expect(flared[1]).toBeGreaterThan(flared[0]); // the chips answer hardest
    // A frame advances the decay by at most MAX_FRAME_STEP, so it takes a few of them.
    let t = 0.35;
    for (let i = 0; i < 12; i += 1) model.update(frame({ dim: 0.4, time: (t += 0.05), focus: 3 }));
    expect(intensities().slice(0, 4)).toEqual([0.4, 0.4, 0.4, 0.4]);
    // Back to today's look without a dim.
    model.update(frame({ time: t + 0.05 }));
    expect(intensities()).toEqual([1, 1, 1, 1, 1]);
    expect([helixDim(undefined), helixDim(Number.NaN), helixDim(-0.5), helixDim(3), helixDim(0.3)]).toEqual([1, 1, 0, 1, 0.3]);
    model.dispose();
  });

  it("helixExitPose: nothing at 0, gone at 1, and every step in between goes one way", () => {
    expect(helixExitPose(0)).toEqual({ reveal: 1, spin: 0, narrow: 1, tall: 1 });
    const spent = helixExitPose(1);
    expect(spent.reveal).toBe(0);
    expect(spent.spin).toBeCloseTo(HELIX_EXIT.spin, 12);
    expect(spent.narrow).toBeCloseTo(HELIX_EXIT.narrow, 12);
    expect(spent.tall).toBeCloseTo(HELIX_EXIT.tall, 12);
    expect(helixExitPose(Number.NaN)).toEqual(helixExitPose(0));
    expect(helixExitPose(5)).toEqual(helixExitPose(1));
    // The strands hold their shape while the deck folds, then draw in and dissolve.
    expect(helixExitPose(0.5).reveal).toBe(1);
    let last = helixExitPose(0);
    for (let e = 0.02; e <= 1; e += 0.02) {
      const now = helixExitPose(e);
      expect(now.reveal, `exit ${e}`).toBeLessThanOrEqual(last.reveal);
      expect(now.spin).toBeGreaterThanOrEqual(last.spin);
      expect(now.narrow).toBeLessThanOrEqual(last.narrow);
      expect(now.tall).toBeGreaterThanOrEqual(last.tall);
      last = now;
    }
  });

  it("helixArrivePose: nothing at 0, the formed helix at 1 — and absent is 1, so a frame that knows nothing of it draws the molecule", () => {
    // The filament's floor is the finish's own narrow: at 0.012 units of tube and 121.5px per
    // unit, anything under it is a sub-pixel line that crawls instead of burning.
    expect(HELIX_ARRIVE.narrow).toBe(HELIX_EXIT.narrow);
    expect(HELIX_ARRIVE.narrow).toBe(0.42);
    const start = helixArrivePose(0);
    expect(start.strands).toBe(0);
    expect(start.narrow).toBeCloseTo(HELIX_ARRIVE.narrow, 12);
    expect(start.spin).toBeCloseTo(HELIX_ARRIVE.spin, 12);
    expect([start.fork, start.bits, start.holo]).toEqual([0, 0, 0]);
    const done = { strands: 1, narrow: 1, spin: 0, fork: 1, bits: 1, holo: 1 };
    expect(helixArrivePose(1)).toEqual(done);
    // Absent, not finite, or out of range: the arrived pose (and the identity at the other end).
    expect(helixArrivePose(undefined)).toEqual(done);
    expect(helixArrivePose(Number.NaN)).toEqual(done);
    expect(helixArrivePose(5)).toEqual(done);
    expect(helixArrivePose(-1)).toEqual(helixArrivePose(0));

    // The five movements, in order and overlapping: each band is spent before the next is over.
    const table: Array<[number, "strands" | "narrow" | "fork" | "bits" | "holo"]> = [
      [HELIX_ARRIVE.strands[1], "strands"],
      [HELIX_ARRIVE.open[1], "narrow"],
      [HELIX_ARRIVE.fork[1], "fork"],
      [HELIX_ARRIVE.bits[1], "bits"],
      [HELIX_ARRIVE.holo[1], "holo"],
    ];
    for (const [at, key] of table) expect(helixArrivePose(at)[key], key).toBeCloseTo(1, 12);
    expect(helixArrivePose(HELIX_ARRIVE.strands[1]).fork).toBe(0);
    expect(helixArrivePose(HELIX_ARRIVE.fork[0]).narrow).toBeGreaterThan(HELIX_ARRIVE.narrow);
    expect(helixArrivePose(HELIX_ARRIVE.bits[0]).fork).toBeGreaterThan(0.5);
    // The wind-up unwinds exactly as the radius opens: one gesture, not two.
    expect(helixArrivePose(HELIX_ARRIVE.open[0]).spin).toBeCloseTo(HELIX_ARRIVE.spin, 12);
    expect(helixArrivePose(HELIX_ARRIVE.open[1]).spin).toBeCloseTo(0, 12);

    // Every step goes one way, and nothing rests half-way outside 0..1.
    let last = helixArrivePose(0);
    for (let a = 0.01; a <= 1; a += 0.01) {
      const now = helixArrivePose(a);
      for (const key of ["strands", "narrow", "fork", "bits", "holo"] as const) {
        expect(now[key], `${key} at ${a}`).toBeGreaterThanOrEqual(last[key]);
        expect(now[key]).toBeLessThanOrEqual(1);
        expect(now[key]).toBeGreaterThanOrEqual(0);
      }
      expect(now.spin, `spin at ${a}`).toBeLessThanOrEqual(last.spin);
      expect(now.narrow).toBeGreaterThanOrEqual(HELIX_ARRIVE.narrow);
      last = now;
    }
  });

  it("the replication bubble: a contiguous window of rungs widening from the middle one outward, both ways at once", () => {
    for (const tier of TIERS) {
      const config = SCENE_TIER_CONFIG[tier];
      const model = createHelixModel(config, PALETTE);
      const { rungs } = parts(model);
      const n = config.helixRungs;
      const mid = Math.floor(n / 2);
      let t = 0;
      /** The window as [first rung drawn, rungs drawn] — 20 vertices per rung (2 halves × 10). */
      const window = (arrive: number): [number, number] => {
        model.update(frame({ time: (t += 0.05), reveal: 1, arrive }));
        const { start, count } = rungs.geometry.drawRange;
        // LineSegments needs an even offset and an even count; every multiple of 20 is both.
        expect(start % 2, `offset at ${arrive}`).toBe(0);
        expect(count % 2, `count at ${arrive}`).toBe(0);
        expect(start % 20).toBe(0);
        expect(count % 20).toBe(0);
        return [start / 20, count / 20];
      };

      // Before the bubble opens nothing of it is drawn at all; at the end, every rung is.
      expect(window(0)).toEqual([mid, 0]);
      expect(window(HELIX_ARRIVE.fork[0])).toEqual([mid, 0]);
      expect(window(HELIX_ARRIVE.fork[1])).toEqual([0, n]);
      expect(window(1)).toEqual([0, n]);
      expect(window(HELIX_ARRIVE.fork[1] + 0.05)).toEqual([0, n]);

      // In between: centred on the middle rung, inside the buffer, and only ever growing.
      let last = 0;
      for (let a = HELIX_ARRIVE.fork[0]; a <= HELIX_ARRIVE.fork[1]; a += 0.02) {
        const [from, drawn] = window(a);
        expect(drawn, `drawn at ${a}`).toBeGreaterThanOrEqual(last);
        expect(from + drawn).toBeLessThanOrEqual(n);
        // Symmetric about the middle: as many rungs below it as above (± the odd one).
        expect(Math.abs(mid - from - (from + drawn - mid))).toBeLessThanOrEqual(1);
        last = drawn;
      }
      // Half way through the bubble roughly half the base pairs are written in.
      const [, halfWay] = window((HELIX_ARRIVE.fork[0] + HELIX_ARRIVE.fork[1]) / 2);
      expect(halfWay).toBeGreaterThan(0.35 * n);
      expect(halfWay).toBeLessThan(0.65 * n);
      model.dispose();
    }
  });

  it("the arrival: the filament writes itself in, unwinds, opens the bubble, then the bits and the hologram — and a pre-warm frame still draws all five", () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.high, PALETTE);
    const { strands, chips, rungs, bits, hologram } = parts(model);
    model.setHologram(new CanvasTexture(document.createElement("canvas")));
    const orient = () => (strands.parent as { parent: { scale: { x: number; y: number } } }).parent;
    const spin = () => (strands.parent as { rotation: { y: number } }).rotation.y;
    let t = 0;
    const at = (arrive: number, over: Partial<HelixFrame> = {}) =>
      model.update(frame({ time: (t += 0.05), reveal: 1, arrive, ...over }));

    // Movement 1: the strands alone, on the axis — one draw, a beam, no chirality yet.
    at(0.1);
    expect(orient().scale.x).toBeCloseTo(helixArrivePose(0.1).narrow, 12);
    // Never taller: a stretch would put the filament over Work's heading at the arming line.
    expect(orient().scale.y).toBe(1);
    expect(uniforms(strands).uReveal.value).toBeGreaterThan(0);
    expect(uniforms(strands).uReveal.value).toBeLessThan(1);
    expect([chips.visible, rungs.visible, bits.visible]).toEqual([false, false, false]);
    expect(hologram.visible).toBe(false);
    // Held back while the two tubes lie on one line: additive blending would otherwise clip white.
    expect(uniforms(strands).uIntensity.value).toBeLessThan(1);

    // Movement 2: the wind-up unwinds into the focus's own turn as the radius opens.
    at(HELIX_ARRIVE.open[0], { focus: 1 });
    expect(spin()).toBeCloseTo(-MODEL_HELIX_ANGLE + HELIX_ARRIVE.spin, 12);
    at(HELIX_ARRIVE.open[1], { focus: 1 });
    expect(spin()).toBeCloseTo(-MODEL_HELIX_ANGLE, 12);
    expect(orient().scale.x).toBeCloseTo(1, 12);

    // Movement 3: the bubble brings the rungs and the chips; the comet rides a fork, not its sweep.
    at(0.7);
    expect([chips.visible, rungs.visible]).toEqual([true, true]);
    expect(bits.visible).toBe(false);
    const mid = Math.floor(SCENE_TIER_CONFIG.high.helixRungs / 2);
    expect(uniforms(rungs).uProg.value).toBeGreaterThan(mid);
    expect(uniforms(rungs).uProg.value).toBeLessThan(SCENE_TIER_CONFIG.high.helixRungs);
    // The chips behind the forks are lit; the ones the bubble has not reached are black, and a
    // black instance adds nothing (lum 0 → alpha 0), so no dissolve heat leaks onto them.
    const colours = chips.instanceColor!.array as Float32Array;
    let dark = 0;
    for (let i = 0; i < chips.count; i += 1) if (colours[i * 3] === 0) dark += 1;
    expect(dark).toBeGreaterThan(0);

    // Movements 4 and 5: the bits flicker on, then the hologram opens vertically from a hairline.
    at(0.8);
    expect(bits.visible).toBe(true);
    expect(uniforms(bits).uReveal.value).toBeLessThan(1);
    expect(hologram.visible).toBe(false);
    at(0.93);
    expect(hologram.visible).toBe(true);
    expect(hologram.scale.y).toBeLessThan(hologram.scale.x);
    at(1);
    expect(hologram.scale.y).toBeCloseTo(hologram.scale.x, 12);
    expect(hologram.visible).toBe(true);
    for (const object of model.objects) expect(uniforms(object).uReveal.value).toBe(1);
    for (let i = 0; i < chips.count; i += 1) expect(colours[i * 3]).toBeGreaterThan(0);
    // No longer held back (the arrival's own flare may still be lifting it on top of that).
    expect(uniforms(strands).uIntensity.value).toBeGreaterThanOrEqual(1);

    /* The pre-warm frame. `stageHelix` queues exactly one, and it happens at the top of the page
       where the arrival has not started: if a band hid a draw there its buffers would never
       upload and the first frame that showed it would compile a shader mid-scroll. */
    model.update(frame({ time: (t += 0.05), reveal: 0, arrive: 0, prewarm: true }));
    expect(model.group.visible).toBe(true);
    for (const object of model.objects) expect(object.visible, object.name).toBe(true);
    for (const object of model.objects) expect(uniforms(object).uReveal.value).toBe(0);
    // …and the whole rung buffer with them: a draw range of zero vertices uploads nothing.
    expect(rungs.geometry.drawRange).toEqual({ start: 0, count: 20 * SCENE_TIER_CONFIG.high.helixRungs });
    model.dispose();
  });

  it("the arrival flares once as the forks reach the ends, and the chips answer a still page (the gate runs in wall clock, the turn does not)", () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.high, PALETTE);
    const { chips, strands } = parts(model);
    const lifted = () => (uniforms(strands).uIntensity.value as number) > 1;
    let t = 0;
    const at = (arrive: number) => model.update(frame({ time: (t += 1 / 60), reveal: 1, arrive }));

    const colours = chips.instanceColor!.array as Float32Array;
    const dark = () => {
      let n = 0;
      for (let i = 0; i < chips.count; i += 1) if (colours[i * 3] === 0) n += 1;
      return n;
    };

    // An already-arrived helix has nothing to announce: no flare on its first frame.
    at(1);
    expect(lifted()).toBe(false);
    expect(dark()).toBe(0);

    /* Every frame from here on is a STILL page: `focus` never moves, so `turn` never moves, and
       the guard `writeFlares` has always had would freeze the chips' colours where they were.
       The bubble runs in wall clock, not in scroll, so it must ask for them again anyway — this
       is the frozen-gate bug the project has paid for once already (CHANGELOG, the spiral). */
    at(0.2);
    expect(dark()).toBe(chips.count);
    for (let a = 0.2; a <= 0.7; a += 0.02) at(a);
    expect(dark()).toBeGreaterThan(0);
    expect(dark()).toBeLessThan(chips.count);
    expect(lifted()).toBe(false);

    // The forks reach the ends: one flare, which then decays away as any other does.
    at(HELIX_ARRIVE.flare);
    expect(lifted()).toBe(true);
    for (let i = 0; i < 40; i += 1) at(1);
    expect(lifted()).toBe(false);
    expect(dark()).toBe(0);
    model.dispose();
  });

  it("the finish winds the helix up, draws it into a beam and dissolves it away", () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.mid, PALETTE);
    const { strands } = parts(model);
    const spin = () => (strands.parent as { rotation: { y: number } }).rotation.y;
    const shape = () => {
      const orient = (strands.parent as { parent: { scale: { x: number; y: number } } }).parent;
      return [orient.scale.x, orient.scale.y];
    };
    model.update(frame({ time: 1, focus: 2, reveal: 1 }));
    expect(shape()).toEqual([1, 1]);
    expect(spin()).toBeCloseTo(-2 * MODEL_HELIX_ANGLE, 12);
    expect(uniforms(strands).uReveal.value).toBe(1);

    model.update(frame({ time: 1.05, focus: 2, reveal: 1, exit: 0.5 }));
    const half = helixExitPose(0.5);
    expect(spin()).toBeCloseTo(-2 * MODEL_HELIX_ANGLE - half.spin, 12);
    expect(shape()[0]).toBeCloseTo(half.narrow, 12);
    expect(shape()[1]).toBeCloseTo(half.tall, 12);
    expect(uniforms(strands).uReveal.value).toBe(1);

    model.update(frame({ time: 1.1, focus: 2, reveal: 1, exit: 0.8 }));
    expect(uniforms(strands).uReveal.value).toBeLessThan(1);
    expect(uniforms(strands).uReveal.value).toBeGreaterThan(0);

    // Spent: nothing of the helix is drawn at all, however revealed the frame says it is.
    model.update(frame({ time: 1.15, focus: 2, reveal: 1, exit: 1 }));
    expect(model.group.visible).toBe(false);
    model.dispose();
  });

  it("setLite hides the bits and swallows the glitch; back to full shows them again", () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.mid, PALETTE);
    const { bits, hologram } = parts(model);
    model.setLite(true);
    expect(bits.visible).toBe(false);
    model.update(frame({ time: 1 }));
    model.glitch();
    model.update(frame({ time: 1.05 }));
    expect(uniforms(hologram).uGlitch.value).toBe(0);
    model.setLite(false);
    expect(bits.visible).toBe(true);
    model.dispose();
  });

  it(`glitch: 1 at once, gone ${HELIX_GLITCH_SECONDS}s later (scene time, even with a held step)`, () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.mid, PALETTE);
    const { hologram } = parts(model);
    model.update(frame({ time: 3 }));
    model.glitch();
    model.update(frame({ time: 3 }));
    expect(uniforms(hologram).uGlitch.value).toBe(1);
    model.update(frame({ time: 3.1 }));
    expect(uniforms(hologram).uGlitch.value).toBeCloseTo(1 - 0.1 / HELIX_GLITCH_SECONDS, 9);
    for (let t = 3.2; t < 3.6; t += 0.05) model.update(frame({ time: t }));
    expect(uniforms(hologram).uGlitch.value).toBe(0);
    model.dispose();
  });

  it(`setAccent eases the strands', chips' and hologram's colour over ~${HELIX_ACCENT_SECONDS}s; null returns to the palette's cyan; rungs and bits keep the palette`, () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.mid, PALETTE);
    const { strands, chips, rungs, bits, hologram } = parts(model);
    const cyan = toColor(PALETTE.cyan);
    const pink = new Color("#ff2d78");
    const colorOf = (object: Object3D) => uniforms(object).uColorA.value as Color;
    const gap = (a: Color, b: Color) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
    const rungColor = colorOf(rungs).clone();
    const bitColor = colorOf(bits).clone();
    for (const object of [strands, chips, hologram]) expect(gap(colorOf(object), cyan)).toBeLessThan(1e-6);

    const start = gap(cyan, pink);
    model.setAccent(pink);
    let t = 0;
    model.update(frame({ time: t }));
    for (let i = 0; i < 6; i += 1) model.update(frame({ time: (t += 1 / 60) }));
    // Under way, not there.
    const early = gap(colorOf(strands), pink);
    expect(early).toBeLessThan(start * 0.9);
    expect(early).toBeGreaterThan(start * 0.3);
    while (t < HELIX_ACCENT_SECONDS) model.update(frame({ time: (t += 1 / 60) }));
    for (const object of [strands, chips, hologram]) expect(gap(colorOf(object), pink)).toBeLessThan(start * 0.06);
    expect(gap(colorOf(rungs), rungColor)).toBe(0);
    expect(gap(colorOf(bits), bitColor)).toBe(0);

    model.setAccent(null);
    for (let i = 0; i < 60; i += 1) model.update(frame({ time: (t += 1 / 60) }));
    expect(gap(colorOf(strands), cyan)).toBeLessThan(start * 0.01);

    // A palette swap keeps the card's accent and lands on it at once. One mode: `uInk` stays 0.
    model.setAccent(pink);
    model.setPalette(PALETTE);
    expect(gap(colorOf(chips), pink)).toBeLessThan(1e-6);
    expect(uniforms(strands).uInk.value).toBe(0);
    model.dispose();
  });

  it("packets, the rung sweep and the bits run on the step: a held step (the swarm landing) holds them", () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.high, PALETTE);
    const { strands, rungs, bits } = parts(model);
    model.update(frame({ time: 5, step: 0 }));
    expect(uniforms(strands).uTime.value).toBe(0);
    expect(uniforms(bits).uTime.value).toBe(0);
    expect(uniforms(rungs).uProg.value).toBeCloseTo(helixRungSweep(0, SCENE_TIER_CONFIG.high.helixRungs), 12);
    model.update(frame({ time: 5.5, step: 0.5 }));
    expect(uniforms(strands).uTime.value).toBe(0.5);
    expect(uniforms(bits).uTime.value).toBe(0.5);
    // The sweep climbs from below the first rung to past the last, then starts again.
    expect(helixRungSweep(0, 22)).toBeCloseTo(-0.2, 12);
    expect(helixRungSweep(4.999, 22)).toBeGreaterThan(22);
    expect(helixRungSweep(5, 22)).toBeCloseTo(-0.2, 9);
    model.dispose();
  });

  it("dispose frees every geometry and material it built (the hologram's texture belongs to its source)", () => {
    const model = createHelixModel(SCENE_TIER_CONFIG.high, PALETTE);
    const texture = new CanvasTexture(document.createElement("canvas"));
    model.setHologram(texture);
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    model.group.traverse((object) => {
      if (object instanceof Mesh || object instanceof LineSegments) {
        geometries.add(object.geometry as BufferGeometry);
        materials.add(object.material as Material);
      }
    });
    expect(geometries.size).toBe(5);
    expect(materials.size).toBe(5);
    const freed = new Set<unknown>();
    for (const item of [...geometries, ...materials]) item.addEventListener("dispose", () => freed.add(item));
    let textureFreed = false;
    texture.addEventListener("dispose", () => {
      textureFreed = true;
    });
    model.dispose();
    expect(freed.size).toBe(10);
    expect(textureFreed).toBe(false);
    texture.dispose();
  });
});

describe("helixSamples — the swarm's slot 0", () => {
  /** Which part a sample lies on (within `EPS`), or null. */
  function partOf(p: Vec3, tier: { helixChips: number; helixRungs: number }): "strand" | "chip" | "rung" | "node" | null {
    const t = p[1] / HELIX.height + 0.5;
    for (const strand of [0, 1]) {
      if (t >= -EPS && t <= 1 + EPS && length3(sub3(p, helixStrandPoint(strand, Math.min(1, Math.max(0, t))))) < EPS) {
        return "strand";
      }
    }
    for (const rung of helixRungs(tier.helixRungs)) {
      for (const half of rung.halves) {
        if (distanceToSegment(p, half.line) < EPS) return "rung";
        if (half.node.some((side) => distanceToSegment(p, side) < EPS)) return "node";
      }
    }
    const half = [HELIX_PARTS.chip.length / 2, HELIX_PARTS.chip.width / 2, HELIX_PARTS.chip.thickness / 2];
    for (const chip of helixChips(tier.helixChips)) {
      const d = sub3(p, chip.centre);
      const local = [dot3(d, chip.along), dot3(d, chip.across), dot3(d, chip.out)];
      const inside = local.every((value, k) => Math.abs(value) <= half[k] + EPS);
      const onFaces = local.filter((value, k) => Math.abs(Math.abs(value) - half[k]) < EPS).length;
      if (inside && onFaces >= 2) return "chip";
    }
    return null;
  }

  for (const tier of TIERS) {
    const config = SCENE_TIER_CONFIG[tier];
    it(`${tier}: every sample lies on a strand, a chip's box edge, a rung's half or a node square of the tier's helix`, () => {
      const samples = helixSamples(config.swarm, undefined, config);
      expect(samples).toHaveLength(config.swarm * 3);
      for (let i = 0; i < config.swarm; i += 1) {
        const p: Vec3 = [samples[i * 3], samples[i * 3 + 1], samples[i * 3 + 2]];
        expect(partOf(p, config), `sample ${i}`).not.toBeNull();
        // Inside the helix's own bounds.
        expect(Math.hypot(p[0], p[2])).toBeLessThanOrEqual(HELIX.radius + HELIX_PARTS.chip.lift + 0.1);
        expect(Math.abs(p[1])).toBeLessThanOrEqual(HELIX.height / 2 + HELIX_PARTS.chip.length);
      }
    });
  }

  it("the high tier is the default, and the same seed gives the same buffer", () => {
    expect(helixSamples(300)).toEqual(helixSamples(300, undefined, SCENE_TIER_CONFIG.high));
    expect(helixSamples(300, 7)).not.toEqual(helixSamples(300));
  });

  it("50% strands, 25% chips, 19% rungs, 6% nodes — and any half of the buffer keeps that mix (the lite prefix)", () => {
    const config = SCENE_TIER_CONFIG.high;
    const samples = helixSamples(config.swarm, undefined, config);
    const share = (from: number, to: number) => {
      const counts = { strand: 0, chip: 0, rung: 0, node: 0 };
      for (let i = from; i < to; i += 1) {
        const part = partOf([samples[i * 3], samples[i * 3 + 1], samples[i * 3 + 2]], config);
        if (part) counts[part] += 1;
      }
      const n = to - from;
      return [counts.strand / n, counts.chip / n, counts.rung / n, counts.node / n];
    };
    const whole = share(0, config.swarm);
    [0.5, 0.25, 0.19, 0.06].forEach((expected, k) => expect(whole[k]).toBeCloseTo(expected, 2));
    for (const half of [share(0, config.swarm / 2), share(config.swarm / 2, config.swarm)]) {
      [0.5, 0.25, 0.19, 0.06].forEach((expected, k) => expect(Math.abs(half[k] - expected)).toBeLessThan(0.08));
    }
  });

  it("fits the services' model radius sideways (the swarm's cloud is sized from it), and is taller than wide", () => {
    const samples = helixSamples(720);
    let wide = 0;
    let tall = 0;
    for (let i = 0; i < 720; i += 1) {
      wide = Math.max(wide, Math.hypot(samples[i * 3], samples[i * 3 + 2]));
      tall = Math.max(tall, Math.abs(samples[i * 3 + 1]));
    }
    expect(wide).toBeLessThan(MODEL_RADIUS);
    expect(tall).toBeGreaterThan(wide);
  });
});
