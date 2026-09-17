/**
 * The Work section's DNA helix: two strands carrying packets (up A, down B), chips riding the
 * strands, base-pair rungs broken by a gap with a square node on each side of it, seven-segment
 * 0/1 bits drifting up the axis, and — in spiral mode — a hologram beside it showing the front
 * project card (three/hologram.ts). The project cards spiral round it: `update` turns the strands
 * by `HELIX_ANGLE` per card of focus, the step the spiral layout turns the cards by, so both turn
 * together; there is no idle spin (life comes from the packets, the rung sweep, the bits and the
 * chips at the front brightening).
 *
 * What the visitor does reaches it through the frame, without a single extra draw:
 *   · `speed` — the scroll's own pace runs the packet clock and lifts the glow, so a flick down
 *     the page races the strand and a still page settles back;
 *   · `pulse()` — a project arriving at the front, or the hologram swapping to it, flares the
 *     strands, the chips and the rungs over `HELIX_PULSE_SECONDS` (uniforms only, no new draw);
 *   · `exit` — the spiral's finish (helix.ts `helixExitAt`): the pivot winds up, the strands are
 *     drawn into a beam and the whole model dissolves away, so Work ends instead of stopping.
 *
 * Draws (one idle compile slice each), all on the existing programs:
 *   · strands (P5 links): both tubes in one geometry, `aTag` 0 on A (outgoing: packets climb) and
 *     1.5 on B (incoming: packets run down, hot);
 *   · chips (P3 edges, instanced): boxes along the strands, `instanceColor` brightening the ones
 *     at the front;
 *   · rungs (P4 synapse): each base pair's two halves and their node squares, a comet sweeping up
 *     rung by rung (`uProg`);
 *   · bits (P4 bits): a 0 and a 1 per slot, showing one at a time;
 *   · hologram (P2 holo): a 1.6 × 1.0 plane, spiral mode only, drawn once it has a texture.
 *
 * Frames: `group` (the world's placement) → `tilt` (pointer tilt) → `orient` (upright in spiral;
 * lying along x in ambient, `HELIX_AMBIENT_ROLL`) → `pivot` (the focus turn). The hologram hangs
 * off `group` itself (`HELIX_HOLOGRAM`), so it faces the viewer whatever the focus. The swarm's
 * slot 0 (`helixSamples`) is this model in `group`'s frame, upright at focus 0.
 */

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Curve,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  PlaneGeometry,
  TubeGeometry,
  Vector3,
  type CanvasTexture,
  type Object3D,
} from "three";
import { mulberry32 } from "@/components/three/random";
import { HELIX, HELIX_ANGLE } from "../../shapes";
import type { SceneTierConfig } from "../../tiers";
import {
  LINE_MODE,
  SURFACE_MODE,
  TUBE_MODE,
  createLineMaterial,
  createSurfaceMaterial,
  createTubeMaterial,
  paint,
  toColor,
} from "../materials";
import type { ScenePalette } from "../palette";
import { HELIX_PARTS, helixChips, helixRungs, helixStrandPoint } from "../samples";
import { mergeTagged, place } from "./types";

export { HELIX_ANGLE };

export type HelixMode = "spiral" | "ambient";

export type HelixFrame = {
  /** Scene time and this frame's clamped step, seconds (a 0 step holds the packets and bits). */
  time: number;
  step: number;
  /** The front card's index, fractional while the cards turn. */
  focus: number;
  /** 0 hidden → 1 formed (a voxel dissolve in between). */
  reveal: number;
  /** Smoothed pointer / gyro tilt, -1..1. */
  tx: number;
  ty: number;
  /** Draw this frame even at reveal 0 (every fragment discards; buffers upload). */
  prewarm: boolean;
  /** Half the drawing buffer's height (device px) and the pixel ratio (unused: no sprites). */
  halfHeightPx: number;
  dpr: number;
  /**
   * Brightness, 0..1 (default 1, today's look): multiplies every draw's `uIntensity` in both
   * themes — the light a glow draw adds, the coverage an ink draw lays over the page. The caller
   * picks the theme's value; the world draws both modes at 1 (the ambient helix lies clear of any
   * text). Out of range clamps; not finite counts as 1.
   */
  dim?: number;
  /**
   * The spiral's finish, 0..1 (helix.ts `helixExitOf`): past the last card the helix winds up,
   * draws itself into a beam and dissolves, so the section resolves instead of stopping dead.
   * Absent or not finite counts as 0.
   */
  exit?: number;
  /**
   * How fast the page is being scrolled, 0 (still) .. 1 (a viewport and more per second): the
   * packets, the bits and the rung comet run with it, so the strand answers the visitor's hand.
   * Absent or not finite counts as 0.
   */
  speed?: number;
};

export type HelixModel = {
  /** Placed by the world (position, scale); the model turns inside it. */
  group: Group;
  /** Every draw object (compiled one per slice): strands, chips, rungs, bits, hologram. */
  objects: Object3D[];
  update(frame: HelixFrame): void;
  setMode(mode: HelixMode): void;
  setAccent(color: Color | null): void;
  setHologram(texture: CanvasTexture | null): void;
  glitch(): void;
  /** A card has arrived at the front: the strands, chips and rungs flare for `HELIX_PULSE_SECONDS`. */
  pulse(): void;
  setLite(lite: boolean): void;
  setPalette(palette: ScenePalette): void;
  dispose(): void;
};

/** How far `orient` rolls about z in ambient mode: the helix lies along x. */
export const HELIX_AMBIENT_ROLL = Math.PI / 2;
/**
 * The hologram plane (model units) and where it hangs beside the helix by default, in `group`'s
 * frame; `layoutHelixHologram` moves it to a layout's box in px.
 */
export const HELIX_HOLOGRAM = { width: 1.6, height: 1, x: 3.2, y: 0.15, z: 0, name: "scene-helix-hologram" } as const;
/** Seconds for the accent to settle on a new card's colour (≈95%). */
export const HELIX_ACCENT_SECONDS = 0.4;
/** Seconds for a hologram swap's glitch to decay from 1 to 0. */
export const HELIX_GLITCH_SECONDS = 0.35;
/** Seconds for one comet sweep up the rungs. */
export const HELIX_SWEEP_SECONDS = 5;
/** Seconds for an arrival flare to decay from 1 to 0. */
export const HELIX_PULSE_SECONDS = 0.55;
/**
 * The finish, as the model draws it (`helixExitPose`): the pivot winds up `spin` radians on top of
 * the focus's own turn, the strands are drawn in to `narrow` of their radius and stretched to
 * `tall` of their height — a beam — and the voxel dissolve takes them away over `fade`. The
 * hologram shrinks to `holo` of its size on the way out.
 */
export const HELIX_EXIT = { spin: 2.2, narrow: 0.42, tall: 1.5, fade: [0.55, 1], holo: 0.55 } as const;
/**
 * How much a flare (`pulse`) and the scroll's own speed add: a multiplier on each draw's
 * `uIntensity`, and — for the speed — on the packet clock, so a fast scroll races the strand.
 * Both are 0 on a still page with no arrival, which is exactly `dim` on every draw.
 */
export const HELIX_DRIVE = {
  pulse: { strands: 0.55, chips: 0.95, rungs: 0.6, bits: 0.5 },
  speed: { clock: 2.6, glow: 0.35 },
} as const;
/** Tilt, radians at full pointer lean: the helix a little, the hologram a little more. */
const TILT = { x: 0.08, y: 0.12, holo: 1.35 } as const;
/** A bit glyph (model units): its box and the break at each seven-segment joint. */
export const HELIX_BIT = { width: 0.05, height: 0.09, joint: 0.01, radius: [0.2, 1.2] } as const;
const BIT_SEED = 0xb175;
/** Chips whose centre is this far towards the viewer (model units) brighten. */
const FRONT = { from: 0.6, to: 0.8, gain: 1.4 } as const;
const STRAND_ALPHA = { glow: 0.42, ink: 0.5 } as const;
const RUNG_ALPHA = { glow: 0.45, ink: 0.55 } as const;
const BIT_ALPHA = { glow: 0.85, ink: 0.8 } as const;
/** The hologram draws a little lighter in ink (before `dim`). */
const HOLO_INTENSITY = { glow: 1, ink: 0.85 } as const;

/** Pure. A frame's `dim` as the multiplier the draws use: clamped to 0..1, 1 when absent or not finite. */
export function helixDim(dim: number | undefined): number {
  return dim === undefined || !Number.isFinite(dim) ? 1 : Math.min(1, Math.max(0, dim));
}

const AMBIENT_ROLL_MATRIX = new Matrix4().makeRotationZ(HELIX_AMBIENT_ROLL);

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

/**
 * Pure. What the finish does to the model at `exit` (0..1): how much of the frame's reveal is
 * left (the dissolve eats the rest), the extra wind-up in radians, and the strand's shape — it
 * narrows and stretches into a beam as it goes.
 */
export function helixExitPose(exit: number): { reveal: number; spin: number; narrow: number; tall: number } {
  const e = clamp01(exit);
  return {
    reveal: 1 - smoothstep(HELIX_EXIT.fade[0], HELIX_EXIT.fade[1], e),
    spin: HELIX_EXIT.spin * e * e,
    narrow: 1 - (1 - HELIX_EXIT.narrow) * e,
    tall: 1 + (HELIX_EXIT.tall - 1) * e,
  };
}

/**
 * Lay the hologram out from screen px (the spiral layout's `holo` box): its centre `dx` right of
 * and `dy` above the helix's centre, `width` px wide (16:10), for a `group` drawn at `pxPerUnit`
 * px per model unit (its world scale over the canvas's world units per px). Allocation-free; a
 * no-op for a non-positive scale.
 */
export function layoutHelixHologram(group: Object3D, dx: number, dy: number, width: number, pxPerUnit: number): void {
  const hologram = group.getObjectByName(HELIX_HOLOGRAM.name);
  if (!hologram || !(pxPerUnit > 0) || !(width > 0)) return;
  hologram.position.set(dx / pxPerUnit, dy / pxPerUnit, HELIX_HOLOGRAM.z);
  const scale = width / pxPerUnit / HELIX_HOLOGRAM.width;
  hologram.scale.setScalar(scale);
  // The size a frame's swap flinch and the finish's shrink are measured against.
  hologram.userData[HOLOGRAM_BASE] = scale;
}

/** `userData` key holding the hologram's laid-out scale, so `update` can ripple around it. */
const HOLOGRAM_BASE = "helixHologramBase";

/**
 * Where the swarm's slot 0 lands: `helixSamples` are the helix upright in `group`'s frame, so in
 * ambient mode the world matrix takes the roll `orient` adds (spiral: `group.matrixWorld` as is).
 * Written into `target`.
 */
export function helixLandingMatrix(group: Object3D, mode: HelixMode, target: Matrix4): Matrix4 {
  target.copy(group.matrixWorld);
  return mode === "ambient" ? target.multiply(AMBIENT_ROLL_MATRIX) : target;
}

/** Pure. The rungs' comet at packet time `time`, in rungs (the synapse shader's `uProg`), bottom to top. */
export function helixRungSweep(time: number, rungs: number): number {
  const phase = Math.max(0, time) / HELIX_SWEEP_SECONDS;
  return (phase - Math.floor(phase)) * (rungs + 1.4) - 0.2;
}

/** Pure. How much a chip at local (x, z) brightens with the helix turned by `turn` about y. */
export function helixFrontFlare(x: number, z: number, turn: number): number {
  const front = -x * Math.sin(turn) + z * Math.cos(turn);
  const e = Math.min(1, Math.max(0, (front - FRONT.from) / (FRONT.to - FRONT.from)));
  return e * e * (3 - 2 * e);
}

/**
 * Pure. A seven-segment glyph's strokes around its centre, `[x0, y0, x1, y1]`: a 0 is four
 * (top, right, bottom, left), a 1 two (upper and lower, on the centre line); every joint is broken.
 */
export function helixBitStrokes(kind: 0 | 1): Array<readonly [number, number, number, number]> {
  const w = HELIX_BIT.width / 2;
  const h = HELIX_BIT.height / 2;
  const j = HELIX_BIT.joint;
  if (kind === 1) {
    return [
      [0, h, 0, j / 2],
      [0, -j / 2, 0, -h],
    ];
  }
  return [
    [-w + j, h, w - j, h],
    [w, h - j, w, -h + j],
    [w - j, -h, -w + j, -h],
    [-w, -h + j, -w, h - j],
  ];
}

/** A strand of the helix as a three curve (`t` is already arc length: a helix has constant speed). */
class StrandCurve extends Curve<Vector3> {
  private readonly strand: 0 | 1;

  // @types/three declares Curve's constructor protected; subclasses re-expose it.
  constructor(strand: 0 | 1) {
    super();
    this.strand = strand;
  }

  override getPoint(t: number, target: Vector3 = new Vector3()): Vector3 {
    const [x, y, z] = helixStrandPoint(this.strand, t);
    return target.set(x, y, z);
  }
}

/** The rungs as segment pairs: per base pair, each half's line (u 0 at its strand → 1 at its node), then its node square (u 1). */
function rungGeometry(count: number): BufferGeometry {
  const positions: number[] = [];
  const u: number[] = [];
  const phase: number[] = [];
  helixRungs(count).forEach((rung, r) => {
    for (const half of rung.halves) {
      positions.push(...half.line.a, ...half.line.b);
      u.push(0, 1);
      phase.push(r, r);
      for (const side of half.node) {
        positions.push(...side.a, ...side.b);
        u.push(1, 1);
        phase.push(r, r);
      }
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("aU", new BufferAttribute(new Float32Array(u), 1));
  geometry.setAttribute("aPhase", new BufferAttribute(new Float32Array(phase), 1));
  return geometry;
}

/** The bits: per slot a 0 then a 1, every vertex at the slot's centre (y 0) with its stroke offset in `aGlyph`. */
function bitGeometry(count: number): BufferGeometry {
  const random = mulberry32(BIT_SEED);
  const zero = helixBitStrokes(0);
  const one = helixBitStrokes(1);
  const positions: number[] = [];
  const glyph: number[] = [];
  const u: number[] = [];
  const phase: number[] = [];
  for (let slot = 0; slot < Math.max(0, Math.floor(count)); slot += 1) {
    const angle = random() * Math.PI * 2;
    const [near, far] = HELIX_BIT.radius;
    const radius = near + (far - near) * random();
    const seed = random();
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    for (const [kind, strokes] of [
      [0, zero],
      [1, one],
    ] as const) {
      for (const [x0, y0, x1, y1] of strokes) {
        positions.push(x, 0, z, x, 0, z);
        glyph.push(x0, y0, x1, y1);
        u.push(kind, kind);
        phase.push(seed, seed);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("aGlyph", new BufferAttribute(new Float32Array(glyph), 2));
  geometry.setAttribute("aU", new BufferAttribute(new Float32Array(u), 1));
  geometry.setAttribute("aPhase", new BufferAttribute(new Float32Array(phase), 1));
  return geometry;
}

export function createHelixModel(config: SceneTierConfig, palette: ScenePalette): HelixModel {
  const group = new Group();
  group.name = "scene-helix";
  const tilt = new Group();
  const orient = new Group();
  const pivot = new Group();
  group.add(tilt);
  tilt.add(orient);
  orient.add(pivot);

  /* strands */
  const [along, around] = config.helixTube;
  const strandGeometry = mergeTagged([
    { geometry: new TubeGeometry(new StrandCurve(0), along, HELIX_PARTS.tube, around, false), tag: 0 },
    { geometry: new TubeGeometry(new StrandCurve(1), along, HELIX_PARTS.tube, around, false), tag: 1.5 },
  ]);
  const strands = createTubeMaterial({ mode: TUBE_MODE.links, roles: { a: "cyan", b: "cyan", hot: "red" }, alpha: STRAND_ALPHA.glow });
  const strandMesh = place(new Mesh(strandGeometry, strands.material), 5);
  strandMesh.name = "scene-helix-strands";
  pivot.add(strandMesh);

  /* chips */
  const chipList = helixChips(config.helixChips);
  const { length, width, thickness } = HELIX_PARTS.chip;
  // A unit box, sized by its instance matrix: the edges shader finds an edge where the box's own
  // coordinates reach ±0.5 (as the chip core's boxes do).
  const chipGeometry = new BoxGeometry(1, 1, 1);
  const chips = createSurfaceMaterial({ mode: SURFACE_MODE.edges, roles: { a: "cyan", b: "blue", hot: "hot" }, instanced: true });
  const chipMesh = place(new InstancedMesh(chipGeometry, chips.material, chipList.length), 6);
  chipMesh.name = "scene-helix-chips";
  const matrix = new Matrix4();
  chipList.forEach((chip, i) => {
    const [a, b, c] = [chip.along, chip.across, chip.out];
    const [x, y, z] = chip.centre;
    matrix.set(
      a[0] * length, b[0] * width, c[0] * thickness, x,
      a[1] * length, b[1] * width, c[1] * thickness, y,
      a[2] * length, b[2] * width, c[2] * thickness, z,
      0, 0, 0, 1,
    );
    chipMesh.setMatrixAt(i, matrix);
  });
  const tint = new Color(1, 1, 1);
  for (let i = 0; i < chipList.length; i += 1) chipMesh.setColorAt(i, tint);
  pivot.add(chipMesh);

  /* rungs */
  const rungCount = Math.max(0, Math.floor(config.helixRungs));
  const rungGeometryBuffer = rungGeometry(rungCount);
  const rungs = createLineMaterial({ mode: LINE_MODE.synapse, roles: { a: "blue", b: "cyan", hot: "red" }, alpha: RUNG_ALPHA.glow });
  const rungLines = place(new LineSegments(rungGeometryBuffer, rungs.material), 5);
  rungLines.name = "scene-helix-rungs";
  pivot.add(rungLines);

  /* bits */
  const bitGeometryBuffer = bitGeometry(config.helixBits);
  const bits = createLineMaterial({ mode: LINE_MODE.bits, roles: { a: "cyan", b: "blue", hot: "hot" }, alpha: BIT_ALPHA.glow });
  bits.uniforms.uSpan.value = HELIX.height;
  const bitLines = place(new LineSegments(bitGeometryBuffer, bits.material), 7);
  bitLines.name = "scene-helix-bits";
  pivot.add(bitLines);

  /* hologram */
  const holoGeometry = new PlaneGeometry(HELIX_HOLOGRAM.width, HELIX_HOLOGRAM.height);
  const holo = createSurfaceMaterial({ mode: SURFACE_MODE.holo, roles: { a: "cyan", b: "blue", hot: "hot" } });
  const holoMesh = place(new Mesh(holoGeometry, holo.material), 8);
  holoMesh.name = HELIX_HOLOGRAM.name;
  holoMesh.position.set(HELIX_HOLOGRAM.x, HELIX_HOLOGRAM.y, HELIX_HOLOGRAM.z);
  holoMesh.visible = false;
  group.add(holoMesh);

  let current = palette;
  let mode: HelixMode = "spiral";
  let lite = false;
  let clock = 0;
  let lastTime = Number.NaN;
  let glitchLeft = 0;
  let pulseLeft = 0;
  let turn = 0;
  let flaredTurn = Number.NaN;
  let dim = 1;
  /** The last intensities written, so a still frame rewrites nothing. */
  let drive = Number.NaN;
  let holoBase = 1;
  /** Where the accent is heading (the card's colour, or the palette's cyan) and where it is. */
  let accentSet = false;
  const accentTarget = new Color();
  const accentNow = new Color();

  const writeAccent = () => {
    strands.uniforms.uColorA.value.copy(accentNow);
    chips.uniforms.uColorA.value.copy(accentNow);
    holo.uniforms.uColorA.value.copy(accentNow);
  };

  const writeFlares = () => {
    flaredTurn = turn;
    chipList.forEach((chip, i) => {
      const flare = helixFrontFlare(chip.centre[0], chip.centre[2], turn);
      chipMesh.setColorAt(i, tint.setScalar(1 + FRONT.gain * flare));
    });
    if (chipMesh.instanceColor) chipMesh.instanceColor.needsUpdate = true;
  };

  /**
   * Every draw's intensity: `dim` over each one's own base (the hologram's depends on the theme),
   * lifted by the arrival flare, the scroll's speed and the strands' slow breath. One number
   * stands for all three, so a frame where nothing drives it rewrites no uniform.
   */
  const writeIntensity = (lift = 0) => {
    drive = lift;
    strands.uniforms.uIntensity.value = dim * (1 + lift * HELIX_DRIVE.pulse.strands);
    chips.uniforms.uIntensity.value = dim * (1 + lift * HELIX_DRIVE.pulse.chips);
    rungs.uniforms.uIntensity.value = dim * (1 + lift * HELIX_DRIVE.pulse.rungs);
    bits.uniforms.uIntensity.value = dim * (1 + lift * HELIX_DRIVE.pulse.bits);
    holo.uniforms.uIntensity.value = HOLO_INTENSITY[current.mode] * dim;
  };

  const applyPalette = (next: ScenePalette) => {
    current = next;
    const ink = next.mode === "ink";
    paint(strands, next);
    paint(chips, next);
    paint(rungs, next);
    paint(bits, next);
    paint(holo, next);
    strands.uniforms.uAlpha.value = ink ? STRAND_ALPHA.ink : STRAND_ALPHA.glow;
    rungs.uniforms.uAlpha.value = ink ? RUNG_ALPHA.ink : RUNG_ALPHA.glow;
    bits.uniforms.uAlpha.value = ink ? BIT_ALPHA.ink : BIT_ALPHA.glow;
    writeIntensity();
    // A theme switch lands on the accent at once: nothing to animate between two palettes.
    if (!accentSet) toColor(next.cyan, accentTarget);
    accentNow.copy(accentTarget);
    writeAccent();
    writeFlares();
  };
  applyPalette(palette);

  const showHologram = (prewarm: boolean) => {
    holoMesh.visible = mode === "spiral" && (holo.uniforms.uMap.value !== null || prewarm);
  };

  return {
    group,
    objects: [strandMesh, chipMesh, rungLines, bitLines, holoMesh],

    update(frame) {
      const exit = helixExitPose(frame.exit ?? 0);
      // The finish takes the reveal down itself: what is left of the frame's is what is drawn.
      const reveal = frame.reveal * exit.reveal;
      group.visible = reveal > 0 || frame.prewarm;
      const dt = Number.isFinite(lastTime) ? Math.min(0.1, Math.max(0, frame.time - lastTime)) : 0;
      lastTime = frame.time;
      if (!group.visible) return;

      turn = -frame.focus * HELIX_ANGLE;
      pivot.rotation.y = turn - exit.spin;
      // Spiral only: the finish draws the strands into a beam. Ambient never has an exit.
      orient.scale.set(exit.narrow, exit.tall, exit.narrow);
      tilt.rotation.set(-frame.ty * TILT.x, frame.tx * TILT.y, 0);
      holoMesh.rotation.set(-frame.ty * TILT.x * TILT.holo, frame.tx * TILT.y * TILT.holo, 0);
      showHologram(frame.prewarm);
      const nextDim = helixDim(frame.dim);

      const speed = clamp01(frame.speed ?? 0);
      const step = Number.isFinite(frame.step) && frame.step > 0 ? frame.step : 0;
      // The packets, the bits and the rung comet run on this clock: the faster the page moves, the
      // faster the strand carries. A still page still has them — the clock keeps its own step.
      clock += step * (1 + HELIX_DRIVE.speed.clock * speed);
      if (Math.abs(turn - flaredTurn) > 1e-4 || !Number.isFinite(flaredTurn)) writeFlares();

      if (dt > 0) {
        accentNow.lerp(accentTarget, 1 - Math.exp(-dt / (HELIX_ACCENT_SECONDS / 3)));
        glitchLeft = Math.max(0, glitchLeft - dt / HELIX_GLITCH_SECONDS);
        pulseLeft = Math.max(0, pulseLeft - dt / HELIX_PULSE_SECONDS);
      }
      writeAccent();

      // Nothing driving it is exactly `dim`: a still page rewrites no uniform.
      const lift = pulseLeft * pulseLeft + HELIX_DRIVE.speed.glow * speed;
      if (nextDim !== dim || lift !== drive) {
        dim = nextDim;
        writeIntensity(lift);
      }

      strands.uniforms.uTime.value = clock;
      strands.uniforms.uReveal.value = reveal;
      chips.uniforms.uTime.value = frame.time;
      chips.uniforms.uReveal.value = reveal;
      rungs.uniforms.uProg.value = helixRungSweep(clock, rungCount);
      rungs.uniforms.uTime.value = frame.time;
      rungs.uniforms.uReveal.value = reveal;
      bits.uniforms.uTime.value = clock;
      bits.uniforms.uReveal.value = reveal;
      holo.uniforms.uTime.value = frame.time;
      holo.uniforms.uReveal.value = reveal;
      holo.uniforms.uGlitch.value = glitchLeft;
      // The hologram flinches on a swap and shrinks away with the finish.
      const base = holoMesh.userData[HOLOGRAM_BASE];
      holoBase = typeof base === "number" && base > 0 ? base : holoBase;
      holoMesh.scale.setScalar(
        holoBase * (1 + 0.07 * glitchLeft) * (1 - (1 - HELIX_EXIT.holo) * clamp01(frame.exit ?? 0)),
      );
    },

    setMode(next) {
      mode = next;
      orient.rotation.z = next === "ambient" ? HELIX_AMBIENT_ROLL : 0;
      showHologram(false);
    },

    setAccent(color) {
      accentSet = color !== null;
      if (color) accentTarget.copy(color);
      else toColor(current.cyan, accentTarget);
    },

    setHologram(texture) {
      holo.uniforms.uMap.value = texture;
      showHologram(false);
    },

    glitch() {
      if (!lite) glitchLeft = 1;
      // The flare is a uniform, not a draw: a swap reads as an event on lite too.
      pulseLeft = 1;
    },

    pulse() {
      pulseLeft = 1;
    },

    setLite(next) {
      // Lite: no bits and no swap glitch. (The strands keep both packets: the links program
      // has no per-strand switch.)
      lite = next;
      bitLines.visible = !lite;
      if (lite) glitchLeft = 0;
    },

    setPalette: applyPalette,

    dispose() {
      strandGeometry.dispose();
      chipGeometry.dispose();
      rungGeometryBuffer.dispose();
      bitGeometryBuffer.dispose();
      holoGeometry.dispose();
      strands.material.dispose();
      chips.material.dispose();
      rungs.material.dispose();
      bits.material.dispose();
      holo.material.dispose();
      chipMesh.dispose();
      holo.uniforms.uMap.value = null;
    },
  };
}
