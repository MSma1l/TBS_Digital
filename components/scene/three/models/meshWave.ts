/**
 * "Brand & UI": a polygon mesh lying back like a floor, rolling in slow waves, with a pulse
 * ring spreading from wherever the pointer leans; nodes ride the vertices and a few UI card
 * outlines float above it. The wave is displaced in the vertex shader (no CPU per vertex).
 *
 * Draws: the wireframe (P4), the nodes (P6), the cards (P4, one geometry). Lite hides the
 * nodes and the cards.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineSegments,
  PlaneGeometry,
  Points,
  WireframeGeometry,
} from "three";
import type { SceneTierConfig } from "../../tiers";
import {
  INK_SPRITES,
  LINE_MODE,
  POINTS_MODE,
  createLineMaterial,
  createPointsMaterial,
  paint,
  paintPoints,
  type LineUniforms,
} from "../materials";
import type { ScenePalette } from "../palette";
import { MESH_WAVE, MODEL_POSES, MODEL_SCALES, SCENE_SEEDS, seedAttributes } from "../samples";
import { place, type SceneModel } from "./types";

const NODE_SIZE = 0.06;
const NODE_ALPHA = 0.85;
const NODE_MAX_CSS_PX = 10;
const CARD_LIFT = 0.75;

type WaveUniforms = Pick<LineUniforms, "uWaveTime" | "uPulseR" | "uOrigin" | "uReveal" | "uTime">;

function wave(u: WaveUniforms, t: number, pulseR: number, ox: number, oy: number, reveal: number): void {
  u.uWaveTime.value = t;
  u.uPulseR.value = pulseR;
  u.uOrigin.value.set(ox, oy);
  u.uReveal.value = reveal;
  u.uTime.value = t;
}

/** A rounded-rectangle outline plus a header rule and two content lines, as segment pairs. */
function cardSegments(w: number, h: number, r: number, out: number[]): void {
  const corner = 5;
  const pts: Array<[number, number]> = [];
  const arc = (cx: number, cy: number, start: number) => {
    for (let i = 0; i <= corner; i += 1) {
      const a = start + (i / corner) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  const hw = w / 2 - r;
  const hh = h / 2 - r;
  arc(hw, hh, 0);
  arc(-hw, hh, Math.PI / 2);
  arc(-hw, -hh, Math.PI);
  arc(hw, -hh, (3 * Math.PI) / 2);
  const push = (a: [number, number], b: [number, number]) => {
    out.push(a[0], a[1], 0, b[0], b[1], 0);
  };
  for (let i = 0; i < pts.length; i += 1) push(pts[i], pts[(i + 1) % pts.length]);
  const left = -w / 2 + 0.08;
  push([left, h / 2 - 0.16], [w / 2 - 0.08, h / 2 - 0.16]);
  push([left, 0.0], [left + w * 0.55, 0.0]);
  push([left, -0.12], [left + w * 0.35, -0.12]);
}

export function createMeshWaveModel(config: SceneTierConfig, palette: ScenePalette): SceneModel {
  const group = new Group();
  group.name = "scene-model-mesh-wave";
  const pose = new Group();
  const [px, py, pz] = MODEL_POSES["mesh-wave"];
  pose.rotation.set(px, py, pz);
  pose.scale.setScalar(MODEL_SCALES["mesh-wave"]);
  group.add(pose);

  const [sx, sy] = config.wave;
  const plane = new PlaneGeometry(MESH_WAVE.width, MESH_WAVE.height, sx, sy);
  const wireGeometry = new WireframeGeometry(plane);
  const wire = createLineMaterial({ mode: LINE_MODE.wave, roles: { a: "blue", b: "cyan", hot: "red" }, alpha: 0.42 });
  const wireLines = place(new LineSegments(wireGeometry, wire.material), 5);
  pose.add(wireLines);

  // Nodes on every other vertex in both directions: a lattice, not a dot grid.
  const node: number[] = [];
  for (let j = 0; j <= sy; j += 2) {
    for (let i = 0; i <= sx; i += 2) {
      node.push((i / sx - 0.5) * MESH_WAVE.width, (j / sy - 0.5) * MESH_WAVE.height, 0);
    }
  }
  plane.dispose();
  const nodeCount = node.length / 3;
  const nodeGeometry = new BufferGeometry();
  nodeGeometry.setAttribute("position", new BufferAttribute(new Float32Array(nodeCount * 3), 3));
  nodeGeometry.setAttribute("aS0", new Float32BufferAttribute(node, 3));
  nodeGeometry.setAttribute("aSeed", new BufferAttribute(seedAttributes(nodeCount, SCENE_SEEDS.samples + 21), 4));
  const nodes = createPointsMaterial({
    mode: POINTS_MODE.waveNodes,
    roles: { a: "cyan", b: "blue", c: "red", hot: "hot" },
    alpha: NODE_ALPHA,
    size: NODE_SIZE,
  });
  const nodePoints = place(new Points(nodeGeometry, nodes.material), 6);
  pose.add(nodePoints);

  const cardCount = config.uiCards;
  const cardPositions: number[] = [];
  const cardSpots: ReadonlyArray<readonly [number, number, number, number, number]> = [
    // x, y, z, w, h
    [-0.85, -0.35, 1.0, 0.95, 0.62],
    [0.75, -0.6, 1.2, 0.8, 0.52],
    [0.2, 0.45, 0.85, 0.7, 0.44],
  ];
  const cardGroups: Group[] = [];
  const cards = createLineMaterial({ mode: LINE_MODE.card, roles: { a: "cyan", b: "blue", hot: "hot" }, alpha: 0.95 });
  const cardRoot = new Group();
  pose.add(cardRoot);
  for (let c = 0; c < cardCount; c += 1) {
    const [cx, cy, cz, cw, ch] = cardSpots[c % cardSpots.length];
    const positions: number[] = [];
    cardSegments(cw, ch, 0.07, positions);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const u = new Float32Array(positions.length / 3);
    for (let i = 0; i < u.length; i += 1) u[i] = i / u.length + c * 0.33;
    geometry.setAttribute("aU", new BufferAttribute(u, 1));
    const lines = place(new LineSegments(geometry, cards.material), 7);
    const holder = new Group();
    holder.position.set(cx, cy, cz);
    // Stood partly back up out of the floor's tilt, so the cards read as screens.
    holder.rotation.x = CARD_LIFT;
    holder.add(lines);
    cardRoot.add(holder);
    cardGroups.push(holder);
    cardPositions.push(cx, cy, cz);
  }

  let ink = palette.mode === "ink";
  const applyPalette = (next: ScenePalette) => {
    ink = next.mode === "ink";
    paint(wire, next);
    paint(cards, next);
    paintPoints(nodes, next);
    nodes.uniforms.uAlpha.value = NODE_ALPHA * (ink ? INK_SPRITES.alpha : 1);
    nodes.uniforms.uSize.value = NODE_SIZE * (ink ? INK_SPRITES.size : 1);
    wire.uniforms.uAlpha.value = ink ? 0.5 : 0.42;
  };
  applyPalette(palette);

  let lite = false;

  return {
    kind: "mesh-wave",
    group,
    objects: [group],

    resetCycle() {
      // The wave is a pure function of time: nothing to rewind.
    },

    update(frame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      const t = frame.time;
      const pulseR = t % MESH_WAVE.pulsePeriod;
      const ox = frame.tx * 0.9;
      const oy = -frame.ty * 0.55;

      wave(wire.uniforms, t, pulseR, ox, oy, frame.reveal);
      wave(nodes.uniforms, t, pulseR, ox, oy, frame.reveal);
      cards.uniforms.uReveal.value = frame.reveal;
      cards.uniforms.uTime.value = t;
      nodes.uniforms.uHalfHeight.value = frame.halfHeightPx;
      nodes.uniforms.uMaxSize.value = NODE_MAX_CSS_PX * frame.dpr;

      cardGroups.forEach((holder, c) => {
        holder.position.z = cardPositions[c * 3 + 2] + Math.sin(t * 0.9 + c * 2.1) * 0.06;
        holder.rotation.set(CARD_LIFT + Math.sin(t * 0.5 + c) * 0.06, Math.cos(t * 0.4 + c * 1.7) * 0.08, 0);
      });
      nodePoints.visible = !lite;
      cardRoot.visible = !lite;
    },

    setLite(next) {
      lite = next;
      nodePoints.visible = !lite;
      cardRoot.visible = !lite;
    },

    setPalette: applyPalette,

    dispose() {
      wireGeometry.dispose();
      nodeGeometry.dispose();
      wire.material.dispose();
      nodes.material.dispose();
      cards.material.dispose();
      for (const holder of cardGroups) {
        for (const child of holder.children) {
          if (child instanceof LineSegments) child.geometry.dispose();
        }
      }
    },
  };
}
