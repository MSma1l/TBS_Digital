/**
 * "Automatizare & API": a plasma hub inside its wire shell, linked to a ring of system
 * satellites — a database, an API, a queue, a service — by curved links that carry packets
 * out to the satellites (cyan) and back in to the hub (red). The hub pulses as each packet
 * arrives.
 *
 * Draws: the hub (P2), its wire (P4), the satellites merged into one geometry (P2), the
 * links merged into one geometry (P5).
 */

import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  LineSegments,
  Matrix4,
  Mesh,
  OctahedronGeometry,
  QuadraticBezierCurve3,
  Quaternion,
  TetrahedronGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { hubLayout, type HubGlyph } from "../../shapes";
import type { SceneTierConfig } from "../../tiers";
import {
  LINE_MODE,
  SURFACE_MODE,
  TUBE_MODE,
  createLineMaterial,
  createSurfaceMaterial,
  createTubeMaterial,
  paint,
} from "../materials";
import type { ScenePalette } from "../palette";
import { HUB, MODEL_POSES, MODEL_SCALES } from "../samples";
import { mergeTagged, place, type SceneModel } from "./types";

/** Seconds per packet trip along a link (the shader's `uTime * 0.5`). */
export const HUB_PACKET_SPEED = 0.5;

/** Pure. Link `index` carries packets in to the hub (odd) or out to its satellite (even). */
export function hubLinkIncoming(index: number): boolean {
  return index % 2 === 1;
}

/** Pure. The hub's arrival pulse at `time` for `links` links (the tube shader's packet heads). */
export function hubArrivalPulse(time: number, links: number): number {
  let pulse = 0;
  for (let i = 0; i < links; i += 1) {
    if (!hubLinkIncoming(i)) continue;
    const phase = (((i * 0.37) % 1) + 1) % 1;
    const head = (((time * HUB_PACKET_SPEED + phase) % 1) + 1) % 1;
    const d = Math.min(head, 1 - head);
    pulse += Math.exp(-((d * 20) ** 2));
  }
  return Math.min(1.5, pulse);
}

function glyphGeometry(glyph: HubGlyph): BufferGeometry {
  const s = HUB.glyph;
  switch (glyph) {
    case "database":
      return new CylinderGeometry(s * 0.75, s * 0.75, s * 1.2, 16, 3);
    case "api":
      return new OctahedronGeometry(s * 0.95, 0);
    case "queue":
      return new BoxGeometry(s * 1.5, s * 0.55, s * 0.9);
    default:
      return new TetrahedronGeometry(s, 0);
  }
}

export function createIntegrationHubModel(config: SceneTierConfig, palette: ScenePalette): SceneModel {
  const group = new Group();
  group.name = "scene-model-integration-hub";
  const pose = new Group();
  const [px, py, pz] = MODEL_POSES["integration-hub"];
  pose.rotation.set(px, py, pz);
  pose.scale.setScalar(MODEL_SCALES["integration-hub"]);
  group.add(pose);

  /* hub */
  const hubGeometry = new IcosahedronGeometry(HUB.core, 2);
  const hub = createSurfaceMaterial({ mode: SURFACE_MODE.plasma, roles: { a: "red", b: "cyan", hot: "hot" }, intensity: 0.85 });
  const hubMesh = place(new Mesh(hubGeometry, hub.material), 5);
  pose.add(hubMesh);

  const wireSource = new IcosahedronGeometry(HUB.wire, 1);
  const wireGeometry = new EdgesGeometry(wireSource);
  wireSource.dispose();
  const wire = createLineMaterial({ mode: LINE_MODE.wire, roles: { a: "cyan", b: "blue", hot: "hot" }, alpha: 0.7 });
  const wireMesh = place(new LineSegments(wireGeometry, wire.material), 6);
  pose.add(wireMesh);

  /* satellites + links, bobbing together */
  const orbit = new Group();
  pose.add(orbit);
  const layout = hubLayout(config.satellites);
  const up = new Vector3(0, 1, 0);
  const satelliteGeometry = mergeTagged(
    layout.map((satellite, index) => {
      const [x, y, z] = satellite.position;
      const turn = new Quaternion().setFromAxisAngle(up, -satellite.angle + index * 0.4);
      return {
        geometry: glyphGeometry(satellite.glyph),
        matrix: new Matrix4().compose(new Vector3(x, y, z), turn, new Vector3(1, 1, 1)),
        tag: index,
      };
    }),
  );
  const satellites = createSurfaceMaterial({ mode: SURFACE_MODE.fresnel, roles: { a: "blue", b: "cyan", hot: "hot" }, intensity: 1.2 });
  const satelliteMesh = place(new Mesh(satelliteGeometry, satellites.material), 6);
  orbit.add(satelliteMesh);

  const [along, around] = config.link;
  const linkGeometry = mergeTagged(
    layout.map((satellite, index) => {
      const [x, y, z] = satellite.position;
      const end = new Vector3(x, y, z);
      const mid = new Vector3(x / 2, y / 2, z / 2 + HUB.lift);
      const curve = new QuadraticBezierCurve3(new Vector3(0, 0, 0), mid, end);
      return {
        geometry: new TubeGeometry(curve, along, 0.02, around, false),
        tag: index + (hubLinkIncoming(index) ? 0.5 : 0),
      };
    }),
  );
  const links = createTubeMaterial({ mode: TUBE_MODE.links, roles: { a: "cyan", b: "cyan", hot: "red" }, alpha: 0.42 });
  const linkMesh = place(new Mesh(linkGeometry, links.material), 5);
  orbit.add(linkMesh);

  const applyPalette = (next: ScenePalette) => {
    paint(hub, next);
    paint(wire, next);
    paint(satellites, next);
    paint(links, next);
    links.uniforms.uAlpha.value = next.mode === "ink" ? 0.5 : 0.42;
  };
  applyPalette(palette);

  let clock = 0;

  return {
    kind: "integration-hub",
    group,
    objects: [group],

    resetCycle() {
      clock = 0;
    },

    update(frame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      clock += frame.step;
      const t = frame.time;
      const pulse = hubArrivalPulse(clock, layout.length);

      hub.uniforms.uTime.value = t;
      hub.uniforms.uPulse.value = 0.35 + pulse;
      hub.uniforms.uReveal.value = frame.reveal;
      hubMesh.scale.setScalar(1 + 0.06 * pulse);
      hubMesh.rotation.y = t * 0.3;

      wire.uniforms.uTime.value = t;
      wire.uniforms.uReveal.value = frame.reveal;
      wire.uniforms.uIntensity.value = 1 + pulse * 0.5;
      wireMesh.rotation.set(t * 0.12, -t * 0.2, 0);

      satellites.uniforms.uReveal.value = frame.reveal;
      satellites.uniforms.uTime.value = t;
      links.uniforms.uTime.value = clock;
      links.uniforms.uReveal.value = frame.reveal;
      orbit.position.y = Math.sin(t * 0.8) * 0.05;
    },

    setLite() {
      // Four draws with no particles: nothing worth dropping.
    },

    setPalette: applyPalette,

    dispose() {
      hubGeometry.dispose();
      wireGeometry.dispose();
      satelliteGeometry.dispose();
      linkGeometry.dispose();
      hub.material.dispose();
      wire.material.dispose();
      satellites.material.dispose();
      links.material.dispose();
    },
  };
}
