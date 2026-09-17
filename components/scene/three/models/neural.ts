/**
 * "Asistenți IA": a layered neural network shaped like a brain — rings of nodes widest in the
 * middle, synapses to the nearest nodes of the next layer. A signal runs through it layer by
 * layer: comets travel along the synapses, pulse heads ride their fronts, and each layer's
 * nodes flare as the signal arrives. Every third cycle a red "response" runs back.
 *
 * Draws: nodes (P3, instanced), synapses (P4), pulse heads (P6). Lite hides the heads.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Points,
} from "three";
import type { SceneTierConfig } from "../../tiers";
import {
  INK_SPRITES,
  LINE_MODE,
  POINTS_MODE,
  SURFACE_MODE,
  createLineMaterial,
  createPointsMaterial,
  createSurfaceMaterial,
  paint,
  paintPoints,
  toColor,
} from "../materials";
import type { ScenePalette } from "../palette";
import { MODEL_POSES, MODEL_SCALES, neuralGraphFor } from "../samples";
import { place, type SceneModel } from "./types";

/** Seconds for one signal to cross the network (plus its tail). */
export const NEURAL_CYCLE_SECONDS = 2.8;
const HEAD_SIZE = 0.09;
const HEAD_MAX_CSS_PX = 14;

/**
 * Pure. Where the signal is at `time`: `prog` in layers (the comet on layer l's synapses is
 * at `prog - l` along them), running forwards, or backwards on every third cycle.
 */
export type NeuralSignal = { prog: number; dir: 1 | -1; cycle: number };

export function neuralSignal(
  time: number,
  layers: number,
  out: NeuralSignal = { prog: 0, dir: 1, cycle: 0 },
): NeuralSignal {
  const cycle = Math.floor(Math.max(0, time) / NEURAL_CYCLE_SECONDS);
  const phase = Math.max(0, time) / NEURAL_CYCLE_SECONDS - cycle;
  const span = layers - 1 + 1.4;
  out.cycle = cycle;
  out.dir = cycle % 3 === 2 ? -1 : 1;
  out.prog = out.dir === 1 ? -0.2 + phase * span : layers - 1 + 0.2 - phase * span;
  return out;
}

export function createNeuralModel(config: SceneTierConfig, palette: ScenePalette): SceneModel {
  const group = new Group();
  group.name = "scene-model-neural";
  const pose = new Group();
  const [px, py, pz] = MODEL_POSES.neural;
  pose.rotation.set(px, py, pz);
  pose.scale.setScalar(MODEL_SCALES.neural);
  group.add(pose);

  const graph = neuralGraphFor(config);
  const layers = graph.layers.length;

  /* nodes */
  const nodeGeometry = new IcosahedronGeometry(0.075, config.nodeDetail);
  const nodes = createSurfaceMaterial({
    mode: SURFACE_MODE.plasma,
    roles: { a: "cyan", b: "blue", hot: "hot" },
    instanced: true,
    intensity: 0.6,
  });
  const nodeMesh = place(new InstancedMesh(nodeGeometry, nodes.material, graph.nodes.length), 6);
  const matrix = new Matrix4();
  graph.nodes.forEach((node, i) => {
    matrix.makeTranslation(node.position[0], node.position[1], node.position[2]);
    nodeMesh.setMatrixAt(i, matrix);
  });
  const tint = new Color(1, 1, 1);
  for (let i = 0; i < graph.nodes.length; i += 1) nodeMesh.setColorAt(i, tint);
  pose.add(nodeMesh);

  /* synapses */
  const edgePositions: number[] = [];
  const edgeU: number[] = [];
  const edgePhase: number[] = [];
  const headStart: number[] = [];
  const headEnd: number[] = [];
  const headSeed: number[] = [];
  for (const [a, b] of graph.edges) {
    const pa = graph.nodes[a].position;
    const pb = graph.nodes[b].position;
    const layer = graph.nodes[a].layer;
    edgePositions.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]);
    edgeU.push(0, 1);
    edgePhase.push(layer, layer);
    headStart.push(pa[0], pa[1], pa[2]);
    headEnd.push(pb[0], pb[1], pb[2]);
    headSeed.push(layer, 0.5, 0.5, 0.5);
  }
  const edgeGeometry = new BufferGeometry();
  edgeGeometry.setAttribute("position", new Float32BufferAttribute(edgePositions, 3));
  edgeGeometry.setAttribute("aU", new Float32BufferAttribute(edgeU, 1));
  edgeGeometry.setAttribute("aPhase", new Float32BufferAttribute(edgePhase, 1));
  const synapses = createLineMaterial({ mode: LINE_MODE.synapse, roles: { a: "blue", b: "cyan", hot: "red" }, alpha: 0.5 });
  const edgeLines = place(new LineSegments(edgeGeometry, synapses.material), 5);
  pose.add(edgeLines);

  /* pulse heads */
  const headCount = graph.edges.length;
  const headGeometry = new BufferGeometry();
  headGeometry.setAttribute("position", new BufferAttribute(new Float32Array(headCount * 3), 3));
  headGeometry.setAttribute("aS0", new Float32BufferAttribute(headStart, 3));
  headGeometry.setAttribute("aS1", new Float32BufferAttribute(headEnd, 3));
  headGeometry.setAttribute("aSeed", new Float32BufferAttribute(headSeed, 4));
  const heads = createPointsMaterial({
    mode: POINTS_MODE.pulses,
    roles: { a: "cyan", b: "blue", c: "red", hot: "hot" },
    alpha: 1,
    size: HEAD_SIZE,
  });
  const headPoints = place(new Points(headGeometry, heads.material), 7);
  pose.add(headPoints);

  let current = palette;
  let ink = palette.mode === "ink";
  let lastDir: 1 | -1 = 1;
  let clock = 0;
  const signal: NeuralSignal = { prog: 0, dir: 1, cycle: 0 };

  const applyPalette = (next: ScenePalette) => {
    current = next;
    ink = next.mode === "ink";
    paint(nodes, next);
    paint(synapses, next);
    paintPoints(heads, next);
    toColor(lastDir === 1 ? next.cyan : next.red, heads.uniforms.uColorA.value);
    heads.uniforms.uSize.value = HEAD_SIZE * (ink ? INK_SPRITES.size : 1);
    heads.uniforms.uAlpha.value = ink ? 0.8 : 1;
    synapses.uniforms.uAlpha.value = ink ? 0.55 : 0.5;
  };
  applyPalette(palette);

  return {
    kind: "neural",
    group,
    objects: [group],

    resetCycle() {
      clock = 0;
    },

    update(frame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      clock += frame.step;
      neuralSignal(clock, layers, signal);
      if (signal.dir !== lastDir) {
        lastDir = signal.dir;
        toColor(lastDir === 1 ? current.cyan : current.red, heads.uniforms.uColorA.value);
      }

      synapses.uniforms.uProg.value = signal.prog;
      synapses.uniforms.uDir.value = signal.dir;
      synapses.uniforms.uReveal.value = frame.reveal;
      synapses.uniforms.uTime.value = frame.time;

      heads.uniforms.uProg.value = signal.prog;
      heads.uniforms.uReveal.value = frame.reveal;
      heads.uniforms.uHalfHeight.value = frame.halfHeightPx;
      heads.uniforms.uMaxSize.value = HEAD_MAX_CSS_PX * frame.dpr;

      nodes.uniforms.uReveal.value = frame.reveal;
      nodes.uniforms.uTime.value = frame.time;
      // A layer's nodes flare as the signal reaches them: either way, when prog = its layer.
      for (let i = 0; i < graph.nodes.length; i += 1) {
        const flare = Math.exp(-(((signal.prog - graph.nodes[i].layer) * 2.4) ** 2));
        nodeMesh.setColorAt(i, tint.setScalar(1 + 1.2 * flare));
      }
      if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
    },

    setLite(lite) {
      headPoints.visible = !lite;
    },

    setPalette: applyPalette,

    dispose() {
      nodeGeometry.dispose();
      edgeGeometry.dispose();
      headGeometry.dispose();
      nodes.material.dispose();
      synapses.material.dispose();
      heads.material.dispose();
      nodeMesh.dispose();
    },
  };
}
