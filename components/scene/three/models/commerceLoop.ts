/**
 * "E-commerce": a closed loop Offer → Payment → Access. Packages ride a tilted three-lobed
 * track through three gates — a ring (the offer), a card-shaped square (payment) and a
 * hexagon (access) — changing shape and colour as they pass each one: a box, a card, a key.
 * Each gate flashes as a package goes through.
 *
 * Draws: the track (P5), the three gates merged into one geometry (P5), the packages (P3,
 * instanced). Lite draws fewer packages.
 */

import {
  BoxGeometry,
  Color,
  Curve,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { COMMERCE_GATES, commerceTrackPoint } from "../../shapes";
import { SCENE_LITE, type SceneTierConfig } from "../../tiers";
import { SURFACE_MODE, TUBE_MODE, createSurfaceMaterial, createTubeMaterial, paint, toColor } from "../materials";
import type { ScenePalette } from "../palette";
import { COMMERCE_GATE_RADIUS, MODEL_POSES, MODEL_SCALES, commerceGateFrame, commerceTangent } from "../samples";
import { mergeTagged, place, type SceneModel } from "./types";

class CommerceCurve extends Curve<Vector3> {
  // @types/three declares Curve's constructor protected; subclasses re-expose it.
  constructor() {
    super();
  }

  override getPoint(u: number, target: Vector3 = new Vector3()): Vector3 {
    const [x, y, z] = commerceTrackPoint(u);
    return target.set(x, y, z);
  }
}

/** Package scale per stage (x, y, z) at base size: box → card → key. */
const PACKAGE_SHAPES: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 1],
  [1.4, 0.9, 0.25],
  [0.6, 1.3, 0.6],
];
const PACKAGE_SIZE = 0.19;
const LUT_SIZE = 256;

/** Pure. How brightly each gate flashes when packages sit at track parameters `us`. */
export function gateFlash(us: ArrayLike<number>, gateU: number, count: number = us.length): number {
  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    let d = Math.abs(us[i] - gateU);
    d = Math.min(d, 1 - d);
    sum += Math.exp(-((d * 60) ** 2));
  }
  return Math.min(1.5, sum);
}

export function createCommerceLoopModel(config: SceneTierConfig, palette: ScenePalette): SceneModel {
  const group = new Group();
  group.name = "scene-model-commerce-loop";
  const pose = new Group();
  const [px, py, pz] = MODEL_POSES["commerce-loop"];
  pose.rotation.set(px, py, pz);
  pose.scale.setScalar(MODEL_SCALES["commerce-loop"]);
  group.add(pose);

  /* track */
  const curve = new CommerceCurve();
  const trackGeometry = new TubeGeometry(curve, config.track, 0.03, 6, true);
  const track = createTubeMaterial({ mode: TUBE_MODE.track, roles: { a: "blue", b: "cyan", hot: "hot" }, alpha: 0.35 });
  const trackMesh = place(new Mesh(trackGeometry, track.material), 5);
  pose.add(trackMesh);

  /* gates: rings the track threads through, turned towards the viewer (samples.ts frames) */
  const zAxis = new Vector3(0, 0, 1);
  const gateParts = COMMERCE_GATES.map((gate, index) => {
    const geometry = new TorusGeometry(COMMERCE_GATE_RADIUS, 0.024, 6, gate.sides);
    const frame = commerceGateFrame(index);
    const matrix = new Matrix4()
      .makeBasis(new Vector3(...frame.u), new Vector3(...frame.v), new Vector3(...frame.normal))
      .setPosition(frame.centre[0], frame.centre[1], frame.centre[2])
      .multiply(new Matrix4().makeRotationZ(gate.rotation));
    return { geometry, matrix, tag: index };
  });
  const gateGeometry = mergeTagged(gateParts);
  const gates = createTubeMaterial({ mode: TUBE_MODE.gates, roles: { a: "cyan", b: "blue", hot: "red" }, alpha: 1 });
  const gateMesh = place(new Mesh(gateGeometry, gates.material), 6);
  pose.add(gateMesh);

  /* packages */
  const maxPackages = config.packages;
  const boxGeometry = new BoxGeometry(1, 1, 1);
  const packages = createSurfaceMaterial({
    mode: SURFACE_MODE.edges,
    roles: { a: "cyan", b: "blue", hot: "hot" },
    instanced: true,
    intensity: 1.1,
  });
  const packageMesh = place(new InstancedMesh(boxGeometry, packages.material, maxPackages), 7);
  pose.add(packageMesh);

  // Track lookup: points and tangents, built once.
  const lutPoints = new Float32Array(LUT_SIZE * 3);
  const lutTangents = new Float32Array(LUT_SIZE * 3);
  for (let i = 0; i < LUT_SIZE; i += 1) {
    const u = i / LUT_SIZE;
    lutPoints.set(commerceTrackPoint(u), i * 3);
    lutTangents.set(commerceTangent(u), i * 3);
  }

  const stageColors = [new Color(), new Color(), new Color()];
  const tint = new Color();
  const position = new Vector3();
  const tangent = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const matrix = new Matrix4();
  const us = new Float32Array(maxPackages);
  let activeCount = maxPackages;
  let clock = 0;

  const applyPalette = (next: ScenePalette) => {
    paint(track, next);
    paint(gates, next);
    paint(packages, next);
    // The packages carry their stage colour per instance.
    packages.uniforms.uColorA.value.setRGB(1, 1, 1);
    toColor(next.cyan, stageColors[0]);
    toColor(next.blue, stageColors[1]);
    toColor(next.red, stageColors[2]);
    track.uniforms.uAlpha.value = next.mode === "ink" ? 0.45 : 0.35;
  };
  applyPalette(palette);

  const write = (reveal: number) => {
    for (let i = 0; i < activeCount; i += 1) {
      const u = (((i / activeCount + clock * 0.075 + 0.012 * Math.sin(clock + i)) % 1) + 1) % 1;
      us[i] = u;
      const f = u * LUT_SIZE;
      const k = Math.floor(f) % LUT_SIZE;
      const k1 = (k + 1) % LUT_SIZE;
      const w = f - Math.floor(f);
      position.set(
        lutPoints[k * 3] + (lutPoints[k1 * 3] - lutPoints[k * 3]) * w,
        lutPoints[k * 3 + 1] + (lutPoints[k1 * 3 + 1] - lutPoints[k * 3 + 1]) * w,
        lutPoints[k * 3 + 2] + (lutPoints[k1 * 3 + 2] - lutPoints[k * 3 + 2]) * w,
      );
      tangent.set(lutTangents[k * 3], lutTangents[k * 3 + 1], lutTangents[k * 3 + 2]);
      quaternion.setFromUnitVectors(zAxis, tangent);

      // Stage: 0 after the offer, 1 after payment, 2 after access; blend near a gate.
      const stageF = u * 3;
      const stage = Math.min(2, Math.floor(stageF));
      const into = stageF - stage;
      const prev = (stage + 2) % 3;
      const blend = Math.min(1, into / 0.09);
      const a = PACKAGE_SHAPES[prev];
      const b = PACKAGE_SHAPES[stage];
      scale.set(a[0] + (b[0] - a[0]) * blend, a[1] + (b[1] - a[1]) * blend, a[2] + (b[2] - a[2]) * blend);
      scale.multiplyScalar(PACKAGE_SIZE);
      matrix.compose(position, quaternion, scale);
      packageMesh.setMatrixAt(i, matrix);
      tint.copy(stageColors[prev]).lerp(stageColors[stage], blend).multiplyScalar(1.6 + 1.2 * (1 - blend));
      packageMesh.setColorAt(i, tint);
    }
    packageMesh.count = activeCount;
    packageMesh.instanceMatrix.needsUpdate = true;
    if (packageMesh.instanceColor) packageMesh.instanceColor.needsUpdate = true;
    const flash = gates.uniforms.uFlash.value;
    flash.set(
      gateFlash(us, COMMERCE_GATES[0].u, activeCount),
      gateFlash(us, COMMERCE_GATES[1].u, activeCount),
      gateFlash(us, COMMERCE_GATES[2].u, activeCount),
    );
    track.uniforms.uReveal.value = reveal;
    gates.uniforms.uReveal.value = reveal;
    packages.uniforms.uReveal.value = reveal;
  };
  write(1);

  return {
    kind: "commerce-loop",
    group,
    objects: [group],

    resetCycle() {
      clock = 0;
    },

    update(frame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      clock += frame.step;
      track.uniforms.uTime.value = frame.time;
      gates.uniforms.uTime.value = frame.time;
      packages.uniforms.uTime.value = frame.time;
      write(frame.reveal);
    },

    setLite(lite) {
      activeCount = lite ? Math.min(maxPackages, SCENE_LITE.packages) : maxPackages;
    },

    setPalette: applyPalette,

    dispose() {
      trackGeometry.dispose();
      gateGeometry.dispose();
      boxGeometry.dispose();
      track.material.dispose();
      gates.material.dispose();
      packages.material.dispose();
      packageMesh.dispose();
    },
  };
}
