/**
 * The hero's "Cybernetic Core": a frosted glass sphere around a plasma nucleus and its
 * counter-rotating wire, three tilted torus rings precessing at their own varying speeds,
 * and a cloud of light particles. Pointer / gyro tilt turns it, a hero CTA boost speeds the
 * rings up, and each boost start sends a light wave out through the cloud.
 *
 * Draw order (renderOrder inside three's opaque → transmissive → transparent lists):
 * nucleus and wire 1 (opaque pass, so the transmission glass refracts them) → glass 2 →
 * rim and rings 3 → cloud 4 → wave shell 5. Nothing is frustum-culled: shaders displace
 * vertices, and there are only a handful of objects.
 */

import {
  BufferAttribute,
  BufferGeometry,
  EdgesGeometry,
  Euler,
  Group,
  IcosahedronGeometry,
  LineSegments,
  Mesh,
  Points,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type MeshPhysicalMaterial,
  type Object3D,
} from "three";
import { CORE, RING_OMEGA, RING_TILTS } from "../shapes";
import { pointsDrawn, type SceneTierConfig } from "../tiers";
import { easeOutCubic } from "../choreography";
import {
  INK_SPRITES,
  LINE_MODE,
  POINTS_MODE,
  SURFACE_MODE,
  TUBE_MODE,
  createFrostGlass,
  createLineMaterial,
  createPhysicalGlass,
  createPointsMaterial,
  createSurfaceMaterial,
  createTubeMaterial,
  paint,
  paintPoints,
  setFrostPalette,
  setPhysicalGlassPalette,
  type FrostUniforms,
} from "./materials";
import type { ScenePalette } from "./palette";
import { SCENE_SEEDS, cloudPositions, seedAttributes } from "./samples";

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
  /** 1 formed → 0 collapsed into the handoff. */
  reveal: number;
  /** Draw this frame even when collapsed (buffers upload; it is scaled to nothing). */
  prewarm: boolean;
  /** Ring radius factor along the hero exit. */
  rings: number;
  /** Brightness (a phone's core sits dimmed behind the copy). */
  dim: number;
  /** Half the drawing buffer's height and the canvas's pixel ratio, for sprite sizes. */
  halfHeightPx: number;
  dpr: number;
};

export type CyberneticCore = {
  /** Placed by the world (position and scale); everything else turns inside it. */
  group: Group;
  /** Every mesh, line set and point set under `group` (compiled one at a time). */
  objects: Object3D[];
  glassKind: "physical" | "frost";
  update(frame: CoreFrame): void;
  setLite(lite: boolean): void;
  setPalette(palette: ScenePalette): void;
  dispose(): void;
};

/** The precession axis of each ring: x, y and z. */
const RING_AXES = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)] as const;

/** Largest cloud sprite, CSS pixels. */
export const CLOUD_MAX_CSS_PX = 9;
const CLOUD_SIZE = 0.038;
const CLOUD_ALPHA = 0.75;

function place<T extends Object3D>(object: T, renderOrder: number): T {
  object.renderOrder = renderOrder;
  object.frustumCulled = false;
  return object;
}

export function createCyberneticCore(config: SceneTierConfig, palette: ScenePalette): CyberneticCore {
  const group = new Group();
  group.name = "scene-core";
  const tilt = new Group();
  group.add(tilt);
  const disposables: Array<{ dispose(): void }> = [];

  /* nucleus + wire */
  const nucleusGeometry = new IcosahedronGeometry(CORE.nucleus, 3);
  const nucleus = createSurfaceMaterial({
    mode: SURFACE_MODE.plasma,
    roles: { a: "cyan", b: "red", hot: "hot" },
    opaque: true,
    intensity: 1,
  });
  const nucleusMesh = place(new Mesh(nucleusGeometry, nucleus.material), 1);
  tilt.add(nucleusMesh);

  const wireSource = new IcosahedronGeometry(0.55, 1);
  const wireGeometry = new EdgesGeometry(wireSource);
  wireSource.dispose();
  const wire = createLineMaterial({ mode: LINE_MODE.wire, roles: { a: "cyan", b: "blue", hot: "hot" }, alpha: 0.75, opaque: true });
  const wireMesh = place(new LineSegments(wireGeometry, wire.material), 1);
  tilt.add(wireMesh);
  disposables.push(nucleusGeometry, nucleus.material, wireGeometry, wire.material);

  /* glass + rim */
  const sphereGeometry = new SphereGeometry(CORE.sphere, config.sphere[0], config.sphere[1]);
  let physical: MeshPhysicalMaterial | null = null;
  let frost: FrostUniforms | null = null;
  let glassMesh: Mesh;
  if (config.glass === "physical") {
    physical = createPhysicalGlass(palette);
    glassMesh = place(new Mesh(sphereGeometry, physical), 2);
    disposables.push(physical);
  } else {
    const glass = createFrostGlass(palette);
    frost = glass.uniforms;
    glassMesh = place(new Mesh(sphereGeometry, glass.material), 2);
    disposables.push(glass.material);
  }
  tilt.add(glassMesh);

  const rim = createSurfaceMaterial({
    mode: SURFACE_MODE.fresnel,
    roles: { a: "cyan", b: "red", hot: "hot" },
    extrude: 0.012,
    intensity: 0.9,
  });
  const rimMesh = place(new Mesh(sphereGeometry, rim.material), 3);
  tilt.add(rimMesh);
  disposables.push(sphereGeometry, rim.material);

  /* rings */
  const ringTilts = RING_TILTS.map((t) => new Quaternion().setFromEuler(new Euler(t[0], t[1], t[2], "XYZ")));
  const rings = CORE.rings.map((radius, i) => {
    const geometry = new TorusGeometry(radius, CORE.tube[i], config.ringRadial, config.ringTubular);
    const material = createTubeMaterial({
      mode: TUBE_MODE.ring,
      roles: { a: "cyan", b: "blue", hot: "hot" },
      alpha: 0.32,
    });
    material.uniforms.uTicks.value = i === 0 ? 1 : 0;
    material.uniforms.uHead.value = i * 0.31;
    const pivot = new Group();
    const mesh = place(new Mesh(geometry, material.material), 3);
    pivot.add(mesh);
    tilt.add(pivot);
    disposables.push(geometry, material.material);
    return { pivot, mesh, material, angle: 0 };
  });

  /* cloud */
  const cloudCount = config.cloud;
  const cloudGeometry = new BufferGeometry();
  cloudGeometry.setAttribute("position", new BufferAttribute(new Float32Array(cloudCount * 3), 3));
  cloudGeometry.setAttribute("aS0", new BufferAttribute(cloudPositions(cloudCount), 3));
  cloudGeometry.setAttribute("aSeed", new BufferAttribute(seedAttributes(cloudCount, SCENE_SEEDS.cloud + 7), 4));
  const cloud = createPointsMaterial({
    mode: POINTS_MODE.cloud,
    roles: { a: "cyan", b: "blue", c: "red", hot: "hot" },
    alpha: CLOUD_ALPHA,
    size: CLOUD_SIZE,
  });
  const cloudPoints = place(new Points(cloudGeometry, cloud.material), 4);
  tilt.add(cloudPoints);
  disposables.push(cloudGeometry, cloud.material);

  /* light wave shell */
  const shellGeometry = new SphereGeometry(1, 48, 24);
  const shell = createSurfaceMaterial({ mode: SURFACE_MODE.shell, roles: { a: "cyan", b: "blue", hot: "hot" } });
  const shellMesh = place(new Mesh(shellGeometry, shell.material), 5);
  shellMesh.visible = false;
  tilt.add(shellMesh);
  disposables.push(shellGeometry, shell.material);

  const paintables = [nucleus, wire, rim, shell, ...rings.map((r) => r.material)];
  const scratch = new Quaternion();
  let head = 0;
  let ink = palette.mode === "ink";

  const applyPalette = (next: ScenePalette) => {
    ink = next.mode === "ink";
    for (const item of paintables) paint(item, next);
    paintPoints(cloud, next);
    cloud.uniforms.uAlpha.value = CLOUD_ALPHA * (ink ? INK_SPRITES.alpha : 1);
    cloud.uniforms.uSize.value = CLOUD_SIZE * (ink ? INK_SPRITES.size : 1);
    if (physical) setPhysicalGlassPalette(physical, next);
    if (frost) setFrostPalette(frost, next);
  };
  applyPalette(palette);

  return {
    group,
    // One draw object each: the scene compiles them one idle slice apart (world.ts).
    objects: [nucleusMesh, wireMesh, glassMesh, rimMesh, ...rings.map((ring) => ring.mesh), cloudPoints, shellMesh],
    glassKind: config.glass,

    update(frame) {
      const { time: t, step, boost, wave } = frame;
      const reveal = frame.reveal;
      group.visible = reveal > 0 || frame.prewarm;
      if (!group.visible) return;

      // Tilt follows the pointer / gyro; the whole core breathes.
      tilt.rotation.set(-frame.ty * 0.22, frame.tx * 0.32, 0);
      tilt.scale.setScalar(Math.pow(reveal, 0.8));

      const waving = wave < 1;
      const w = easeOutCubic(wave);
      const fade = (1 - wave) * (1 - wave);
      const flash = waving ? 0.6 * fade * (1 - wave) : 0;
      const dissolve = Math.min(1, reveal * 1.25);
      const light = frame.dim;

      glassMesh.scale.setScalar(1 + 0.012 * Math.sin(1.4 * t) + 0.03 * flash);
      rimMesh.scale.copy(glassMesh.scale);

      nucleus.uniforms.uTime.value = t;
      nucleus.uniforms.uPulse.value = 0.5 + 0.5 * Math.sin(2.2 * t) + flash * 2 + boost * 0.35;
      // Behind transmission glass the nucleus is also blurred across the whole sphere: keep it lower.
      nucleus.uniforms.uIntensity.value = light * (ink ? 0.9 : 1.1) * (physical ? 0.4 : 1);
      nucleus.uniforms.uReveal.value = dissolve;
      nucleusMesh.rotation.set(t * 0.21, t * 0.34, 0);

      wire.uniforms.uTime.value = t;
      wire.uniforms.uIntensity.value = light * (1 + boost * 0.4) * (physical ? 0.6 : 1);
      wire.uniforms.uReveal.value = dissolve;
      wireMesh.rotation.set(-t * 0.17, -t * 0.26, t * 0.05);

      // Ink rims are coverage, not light: at full strength they read as a hard outline.
      rim.uniforms.uIntensity.value = light * (0.9 + boost * 0.5 + flash) * (ink ? 0.55 : 1);
      rim.uniforms.uReveal.value = dissolve;
      if (frost) {
        frost.uTime.value = t;
        frost.uGlow.value = boost * 0.6 + flash;
        frost.uDim.value = light * Math.min(1, reveal * 1.5);
      }

      head = (head + step * 0.22 * (1 + 1.5 * boost)) % 1;
      const ringScale = frame.rings * (0.6 + 0.4 * reveal);
      rings.forEach((ring, i) => {
        const k = 0.85 + 0.3 * Math.sin(0.21 * t + 2.1 * i);
        ring.angle += step * RING_OMEGA[i] * k * (1 + 2.2 * boost);
        scratch.setFromAxisAngle(RING_AXES[i], ring.angle).multiply(ringTilts[i]);
        ring.pivot.quaternion.copy(scratch);
        ring.pivot.scale.setScalar(ringScale);
        const u = ring.material.uniforms;
        u.uHead.value = (head + i * 0.31) % 1;
        u.uCometGain.value = boost * 0.6 + (waving ? 1.5 * fade : 0);
        u.uIntensity.value = light * (1 + boost * 0.35);
        u.uReveal.value = dissolve;
        u.uTime.value = t;
      });

      const cu = cloud.uniforms;
      cu.uTime.value = t;
      cu.uReveal.value = reveal;
      cu.uIntensity.value = light;
      cu.uWaveR.value = waving ? 1 + 2.3 * w : 0;
      cu.uWaveAmp.value = waving ? 1 - wave : 0;
      cu.uHalfHeight.value = frame.halfHeightPx;
      cu.uMaxSize.value = CLOUD_MAX_CSS_PX * frame.dpr;

      shellMesh.visible = waving;
      if (waving) {
        shellMesh.scale.setScalar(1 + 2.3 * w);
        shell.uniforms.uFade.value = fade;
        shell.uniforms.uIntensity.value = light;
        shell.uniforms.uReveal.value = dissolve;
      }
    },

    setLite(lite) {
      cloudGeometry.setDrawRange(0, pointsDrawn(cloudCount, lite));
      for (const ring of rings) ring.material.uniforms.uHead2.value = lite ? 0 : 1;
    },

    setPalette: applyPalette,

    dispose() {
      for (const item of disposables) item.dispose();
    },
  };
}
