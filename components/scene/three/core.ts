/**
 * The hero's neon microprocessor: a substrate with a heat spreader and a plasma die stacked on
 * it, pins on all four sides, and board traces fanning out from the pins to square vias.
 * Packets run the traces out to the board and back in to the pins; a pin flares as a packet
 * leaves or lands. Pointer / gyro tilt turns it, a hero CTA boost speeds the packets up and
 * each boost start sends a square light wave out across the board. Along the hero exit the
 * spreader and the die lift off the substrate (the exploded view) and the chip dissolves.
 *
 * Draws (one idle compile slice each), all on the existing programs:
 *   · boxes (P3 edges, instanced): substrate, heat spreader, die frame, then the pins in
 *     `chipPins` order — `instanceColor` carries each box's hue and a pin's flare;
 *   · the die top (P2 plasma);
 *   · lines (P4 wire): the vias, the spreader's bevel and pin-1 notch, the die grid;
 *   · traces (P5 links): flat ribbons, two triangles per run with 45° mitres, `uv.x` the share
 *     of the trace's length from its pin, `aTag` = trace + .5 on the odd (incoming) ones;
 *   · the light wave (P4 wire), a square drawn only while it runs.
 * Chip plane: x right, y up, z out of the board (samples.ts `CHIP_STACK`). Nothing is
 * frustum-culled: the dissolve discards fragments and there are only five objects.
 */

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type Object3D,
} from "three";
import { CHIP, CHIP_POSE, chipPins, chipTraces } from "../shapes";
import type { SceneTierConfig } from "../tiers";
import { clamp01, easeOutCubic } from "../choreography";
import {
  LINE_MODE,
  SURFACE_MODE,
  TUBE_MODE,
  createLineMaterial,
  createSurfaceMaterial,
  createTubeMaterial,
  paint,
  toColor,
} from "./materials";
import type { ScenePalette } from "./palette";
import { CHIP_LIFT, CHIP_STACK } from "./samples";
import { place } from "./models/types";

export type CoreFrame = {
  /** Scene time and this frame's clamped step, seconds. */
  time: number;
  step: number;
  /** Smoothed tilt, -1..1. */
  tx: number;
  ty: number;
  /** CTA boost, 0..1. */
  boost: number;
  /** Light wave progress, 1 when idle. */
  wave: number;
  /** 1 formed → 0 dissolved. */
  reveal: number;
  /** Draw this frame even when dissolved (buffers upload; every fragment discards). */
  prewarm: boolean;
  /** The exploded view along the hero exit, 0 stacked → 1 lifted apart. */
  lift: number;
  /** Brightness (a phone's chip sits dimmed behind the copy). */
  dim: number;
};

export type ChipCore = {
  /** Placed by the world (position and scale); everything else turns inside it. */
  group: Group;
  /** Every draw object under `group` (compiled one at a time). */
  objects: Object3D[];
  update(frame: CoreFrame): void;
  setLite(lite: boolean): void;
  setPalette(palette: ScenePalette): void;
  dispose(): void;
};

/** Trips per second of a packet along a trace (the links shader's `uTime * 0.5`). */
export const CHIP_PACKET_SPEED = 0.5;
/** Full width of a trace ribbon, scene units. */
export const CHIP_TRACE_WIDTH = 0.034;
/** A trace's resting strength (the packets add to it). */
const TRACE_ALPHA = { glow: 0.45, ink: 0.55 } as const;
/** Boxes before the pins in the instanced draw: substrate, heat spreader, die frame. */
const BODY_BOXES = 3;

/** Pure. Trace `index` carries packets in to its pin (odd) or out to the board (even). */
export function chipTraceIncoming(index: number): boolean {
  return index % 2 === 1;
}

/** Pure. Pin `index`'s flare at packet time `time`: 1 as its packet leaves or lands, 0 between. */
export function chipPinFlare(time: number, index: number): number {
  const phase = (((index * 0.37) % 1) + 1) % 1;
  const head = (((time * CHIP_PACKET_SPEED + phase) % 1) + 1) % 1;
  const d = Math.min(head, 1 - head);
  return Math.exp(-((d * 20) ** 2));
}

/** Pure. The die's arrival pulse over `traces` traces (the hub's formula: incoming packets). */
export function chipArrivalPulse(time: number, traces: number): number {
  let pulse = 0;
  for (let i = 0; i < traces; i += 1) {
    if (chipTraceIncoming(i)) pulse += chipPinFlare(time, i);
  }
  return Math.min(1.5, pulse);
}

type Point = readonly [number, number];

/** The polyline without zero-length runs (a centre trace has no chamfer). */
function distinct(run: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of run) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-9) out.push(p);
  }
  return out;
}

/**
 * Flat ribbons along `traces` at height `z`, `width` wide: two counter-clockwise triangles per
 * run (seen from +z), mitred at every bend, normal +z.
 */
export function traceRibbons(traces: ReadonlyArray<readonly Point[]>, width: number, z: number): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const tags: number[] = [];
  const half = width / 2;

  traces.forEach((trace, index) => {
    const run = distinct(trace);
    if (run.length < 2) return;
    const lengths = [0];
    for (let i = 1; i < run.length; i += 1) {
      lengths.push(lengths[i - 1] + Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]));
    }
    const total = lengths[lengths.length - 1];
    // The left normal of run i (p_i → p_i+1).
    const normal = (i: number): Point => {
      const dx = run[i + 1][0] - run[i][0];
      const dy = run[i + 1][1] - run[i][1];
      const l = Math.hypot(dx, dy);
      return [-dy / l, dx / l];
    };
    // Offset at vertex j: the mitre of its two runs' normals, half a width off the centre line.
    const offsets = run.map((_, j): Point => {
      if (j === 0) return [normal(0)[0] * half, normal(0)[1] * half];
      if (j === run.length - 1) return [normal(j - 1)[0] * half, normal(j - 1)[1] * half];
      const a = normal(j - 1);
      const b = normal(j);
      // Along a + b, scaled so its component along either normal is half a width.
      const mx = a[0] + b[0];
      const my = a[1] + b[1];
      const k = half / Math.max(1e-6, mx * a[0] + my * a[1]);
      return [mx * k, my * k];
    });
    const tag = index + (chipTraceIncoming(index) ? 0.5 : 0);
    const vertex = (j: number, side: 1 | -1) => {
      positions.push(run[j][0] + offsets[j][0] * side, run[j][1] + offsets[j][1] * side, z);
      normals.push(0, 0, 1);
      uvs.push(lengths[j] / total, side > 0 ? 1 : 0);
      tags.push(tag);
    };
    for (let i = 0; i + 1 < run.length; i += 1) {
      // right(i), right(i+1), left(i+1) · right(i), left(i+1), left(i)
      vertex(i, -1);
      vertex(i + 1, -1);
      vertex(i + 1, 1);
      vertex(i, -1);
      vertex(i + 1, 1);
      vertex(i, 1);
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aTag", new Float32BufferAttribute(tags, 1));
  return geometry;
}

/** The outline of a square of half-size `half` centred on (cx, cy) at height `z`, as segment pairs. */
function squareSegments(cx: number, cy: number, half: number, z: number, out: number[]): void {
  const corners: Point[] = [
    [cx - half, cy - half],
    [cx + half, cy - half],
    [cx + half, cy + half],
    [cx - half, cy + half],
  ];
  for (let i = 0; i < 4; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    out.push(a[0], a[1], z, b[0], b[1], z);
  }
}

export function createChipCore(config: SceneTierConfig, palette: ScenePalette): ChipCore {
  const group = new Group();
  group.name = "scene-core";
  const pose = new Group();
  pose.rotation.set(CHIP_POSE[0], CHIP_POSE[1], CHIP_POSE[2]);
  group.add(pose);

  const traces = chipTraces(config.chipTraces);
  const pins = chipPins(config.chipTraces);

  /* boxes: substrate, heat spreader, die frame, pins */
  const boxGeometry = new BoxGeometry(1, 1, 1);
  const boxes = createSurfaceMaterial({
    mode: SURFACE_MODE.edges,
    roles: { a: "cyan", b: "blue", hot: "hot" },
    instanced: true,
  });
  const boxMesh = place(new InstancedMesh(boxGeometry, boxes.material, BODY_BOXES + pins.length), 2);
  pose.add(boxMesh);
  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  const identity = new Quaternion();
  const setBox = (index: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    boxMesh.setMatrixAt(index, matrix.compose(position.set(x, y, z), identity, scale.set(sx, sy, sz)));
  };
  setBox(0, 0, 0, CHIP_STACK.pkg, 2 * CHIP.pkg, 2 * CHIP.pkg, CHIP.thick.pkg);
  pins.forEach((pin, i) => {
    const z = CHIP_STACK.board + CHIP.pinSize.t / 2;
    setBox(BODY_BOXES + i, pin.center[0], pin.center[1], z, pin.size[0], pin.size[1], CHIP.pinSize.t);
  });

  /* the die top */
  const dieGeometry = new BoxGeometry(2 * CHIP.die * 0.88, 2 * CHIP.die * 0.88, CHIP.thick.die);
  const die = createSurfaceMaterial({ mode: SURFACE_MODE.plasma, roles: { a: "cyan", b: "red", hot: "hot" } });
  const dieMesh = place(new Mesh(dieGeometry, die.material), 1);
  pose.add(dieMesh);

  /* lines: vias (fixed), then the spreader's bevel and pin-1 notch, then the die grid (lifted) */
  const segments: number[] = [];
  for (const trace of traces) {
    const [x, y] = trace[trace.length - 1];
    squareSegments(x, y, CHIP.via, CHIP_STACK.board, segments);
  }
  const fixedVertices = segments.length / 3;
  const ihsTop = CHIP_STACK.ihs + CHIP.thick.ihs / 2;
  // As the static art draws them: the bevel 0.1 inside the spreader's edge, pin 1 a 45° cut
  // across its top-left corner.
  squareSegments(0, 0, CHIP.ihs - 0.1, ihsTop, segments);
  const notch = 0.18;
  segments.push(-CHIP.ihs, CHIP.ihs - notch, ihsTop, -CHIP.ihs + notch, CHIP.ihs, ihsTop);
  const dieVertices = segments.length / 3;
  const dieTop = CHIP_STACK.die + CHIP.thick.die / 2 + 0.002;
  for (const k of [-1, 1]) {
    const g = (k * CHIP.die) / 3;
    segments.push(g, -CHIP.die, dieTop, g, CHIP.die, dieTop);
    segments.push(-CHIP.die, g, dieTop, CHIP.die, g, dieTop);
  }
  const baseZ = new Float32Array(segments.length / 3);
  for (let v = 0; v < baseZ.length; v += 1) baseZ[v] = segments[v * 3 + 2];
  const lineGeometry = new BufferGeometry();
  const linePositions = new Float32BufferAttribute(segments, 3);
  lineGeometry.setAttribute("position", linePositions);
  const lines = createLineMaterial({ mode: LINE_MODE.wire, roles: { a: "cyan", b: "blue", hot: "hot" }, alpha: 0.7 });
  const lineMesh = place(new LineSegments(lineGeometry, lines.material), 3);
  pose.add(lineMesh);

  /* traces */
  const traceGeometry = traceRibbons(traces, CHIP_TRACE_WIDTH, CHIP_STACK.board);
  const links = createTubeMaterial({ mode: TUBE_MODE.links, roles: { a: "blue", b: "cyan", hot: "red" }, alpha: TRACE_ALPHA.glow });
  const traceMesh = place(new Mesh(traceGeometry, links.material), 2);
  pose.add(traceMesh);

  /* the light wave: a square leaving the substrate's edge */
  const waveSegments: number[] = [];
  squareSegments(0, 0, CHIP.pkg * 1.05, CHIP_STACK.board, waveSegments);
  const waveGeometry = new BufferGeometry();
  waveGeometry.setAttribute("position", new Float32BufferAttribute(waveSegments, 3));
  const wave = createLineMaterial({ mode: LINE_MODE.wire, roles: { a: "cyan", b: "blue", hot: "hot" }, alpha: 0.9 });
  const waveMesh = place(new LineSegments(waveGeometry, wave.material), 4);
  waveMesh.visible = false;
  pose.add(waveMesh);

  /* colours: each box carries its own hue (the material's A is white) */
  const substrateColor = new Color();
  const spreaderColor = new Color();
  const dieFrameColor = new Color();
  const pinColor = new Color();
  const scratch = new Color();
  let ink = palette.mode === "ink";
  let lite = false;
  let clock = 0;
  let lastLift = 0;

  const writePins = (time: number, flare: boolean) => {
    for (let i = 0; i < pins.length; i += 1) {
      const gain = flare ? (chipTraceIncoming(i) ? 1.6 : 0.7) * chipPinFlare(time, i) : 0;
      boxMesh.setColorAt(BODY_BOXES + i, scratch.copy(pinColor).multiplyScalar(1 + gain));
    }
    if (boxMesh.instanceColor) boxMesh.instanceColor.needsUpdate = true;
  };

  const applyPalette = (next: ScenePalette) => {
    ink = next.mode === "ink";
    paint(boxes, next);
    paint(die, next);
    paint(lines, next);
    paint(links, next);
    paint(wave, next);
    boxes.uniforms.uColorA.value.setRGB(1, 1, 1);
    toColor(next.blue, substrateColor).multiplyScalar(1.1);
    toColor(next.cyan, spreaderColor);
    toColor(next.cyan, dieFrameColor).multiplyScalar(1.5);
    toColor(next.cyan, pinColor);
    boxMesh.setColorAt(0, substrateColor);
    boxMesh.setColorAt(1, spreaderColor);
    boxMesh.setColorAt(2, dieFrameColor);
    writePins(clock, !lite);
    links.uniforms.uAlpha.value = ink ? TRACE_ALPHA.ink : TRACE_ALPHA.glow;
    lines.uniforms.uAlpha.value = ink ? 0.8 : 0.7;
  };

  /** The exploded view: the spreader and the die (with their lines) rise along local z. */
  const writeLift = (lift: number) => {
    const ihsZ = CHIP_STACK.ihs + CHIP_LIFT.ihs * lift;
    const dieZ = CHIP_STACK.die + CHIP_LIFT.die * lift;
    setBox(1, 0, 0, ihsZ, 2 * CHIP.ihs, 2 * CHIP.ihs, CHIP.thick.ihs);
    setBox(2, 0, 0, dieZ, 2 * CHIP.die, 2 * CHIP.die, CHIP.thick.die);
    boxMesh.instanceMatrix.needsUpdate = true;
    dieMesh.position.z = dieZ;
    const z = linePositions.array as Float32Array;
    for (let v = fixedVertices; v < baseZ.length; v += 1) {
      z[v * 3 + 2] = baseZ[v] + (v < dieVertices ? CHIP_LIFT.ihs : CHIP_LIFT.die) * lift;
    }
    linePositions.needsUpdate = true;
  };

  applyPalette(palette);
  writeLift(0);

  return {
    group,
    // One draw object each: the scene compiles them one idle slice apart (world.ts).
    objects: [boxMesh, dieMesh, lineMesh, traceMesh, waveMesh],

    update(frame) {
      const reveal = frame.reveal;
      group.visible = reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      const { time: t, step, boost } = frame;

      pose.rotation.set(CHIP_POSE[0] - frame.ty * 0.22, CHIP_POSE[1] + frame.tx * 0.32, CHIP_POSE[2]);
      const lift = clamp01(frame.lift);
      if (lift !== lastLift) {
        lastLift = lift;
        writeLift(lift);
      }

      const waving = frame.wave < 1;
      const w = easeOutCubic(frame.wave);
      const fade = (1 - frame.wave) * (1 - frame.wave);
      const flash = waving ? 0.6 * fade * (1 - frame.wave) : 0;
      const dissolve = Math.min(1, reveal * 1.25);
      const light = frame.dim;

      clock += step * (1 + 1.5 * boost);
      if (!lite) writePins(clock, true);
      const arrival = chipArrivalPulse(clock, traces.length);

      boxes.uniforms.uTime.value = t;
      boxes.uniforms.uReveal.value = dissolve;
      boxes.uniforms.uIntensity.value = light * (1 + boost * 0.3 + flash);

      die.uniforms.uTime.value = t;
      die.uniforms.uPulse.value = 0.5 + 0.5 * Math.sin(2.2 * t) + 0.3 * arrival + boost * 0.35 + flash * 2;
      die.uniforms.uIntensity.value = light * (ink ? 0.9 : 1.05);
      die.uniforms.uReveal.value = dissolve;

      lines.uniforms.uTime.value = t;
      lines.uniforms.uIntensity.value = light * (1 + boost * 0.4);
      lines.uniforms.uReveal.value = dissolve;

      links.uniforms.uTime.value = clock;
      links.uniforms.uIntensity.value = light * (1 + boost * 0.35 + flash);
      links.uniforms.uReveal.value = dissolve;

      waveMesh.visible = waving;
      if (waving) {
        waveMesh.scale.set(1 + 2.3 * w, 1 + 2.3 * w, 1);
        wave.uniforms.uTime.value = t;
        wave.uniforms.uIntensity.value = fade * light;
        wave.uniforms.uReveal.value = dissolve;
      }
    },

    setLite(next) {
      // Lite: the pins stop flaring (no per-frame colour upload); the packets keep running.
      lite = next;
      writePins(clock, !lite);
    },

    setPalette: applyPalette,

    dispose() {
      boxGeometry.dispose();
      dieGeometry.dispose();
      lineGeometry.dispose();
      traceGeometry.dispose();
      waveGeometry.dispose();
      boxes.material.dispose();
      die.material.dispose();
      lines.material.dispose();
      links.material.dispose();
      wave.material.dispose();
      boxMesh.dispose();
    },
  };
}
