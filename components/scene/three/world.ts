/**
 * The interior scene as one imperative object — since 2026-10-28 that is Work's DNA helix and
 * nothing else. Hero, Ticker and Directions draw static SVG art and the service pages have no
 * stage at all, so the hero chip, the service models, the morph swarm, the cursor trail, the
 * stat panels and the projects laptop are gone from this world, and from the lazy chunk with it.
 *
 * `SceneWorld.tsx` creates it once, stages the helix (`stageHelix`: one idle slice to build it,
 * then one compile slice per draw object, then a pre-warm frame), calls `update` from `useFrame`
 * and disposes it on unmount. Every per-frame write lives here (React Compiler lint), the Work
 * spiral driver's included (`attachWork`: the world asks it for the focus, turns the helix to it,
 * then lets it lay the cards out for the same focus).
 *
 * The root draws nothing until the helix is queued for its pre-warm frame, so a frame between two
 * slices never compiles a shader. Until the helix is built the work gate stays shut and the cards
 * stay as the server rendered them.
 */

import { Group, type Camera, type Object3D, type Scene, type WebGLRenderer } from "three";
import type { SceneHelixMode, ScrollProbe } from "@/lib/scene";
import {
  composeHelix,
  createHelixComposition,
  helixArriveSpan,
  placeHelixAmbient,
  placeHelixSpiral,
  worldPerPx,
  type Placement,
} from "../choreography";
import { damp } from "@/components/three/motion";
import { stepSceneFx, type SceneFx } from "../fx";
import { HELIX_LAYOUT } from "../helix";
import { SCENE_TIER_CONFIG, type SceneCanvasTier } from "../tiers";
import type { WorkHelixDriver } from "../workHelix";
import { compileStaged, nextIdle, type StagedOptions } from "./compile";
import { createHologramSource, type HologramSource } from "./hologram";
import { toColor } from "./materials";
import { createHelixModel, layoutHelixHologram, type HelixFrame, type HelixModel } from "./models/helix";
import { parseTokenColor, type ScenePalette } from "./palette";

/** What the world needs of R3F's root state (structural, so the world stays R3F-free). */
export type WorldView = { size: { width: number; height: number }; viewport: { dpr: number } };

export type SceneWorld = {
  root: Group;
  /** Build Work's helix (the one part; `stageHelix` calls it in an idle slice of its own). */
  buildHelix(): void;
  /** The helix's draw objects, to compile one per idle slice (empty until it is built). */
  helixObjects(): Object3D[];
  /**
   * These objects compiled: draw their parts once more at reveal 0 on the next frame (buffers
   * upload, every fragment discards). The root starts drawing with the first such call.
   */
  prewarm(objects: readonly Object3D[]): void;
  /** The helix compiled and queued for its pre-warm frame: from the next frame the driver hears `built`. */
  markHelixBuilt(): void;
  helixBuilt(): boolean;
  /** One frame: `scrollY` read once by the caller, the canvas's size from `view`. */
  update(dt: number, scrollY: number, view: WorldView, probe: ScrollProbe, fx: SceneFx): void;
  /**
   * Hand over Work's spiral driver (workHelix.ts): from then on every `update` reads its focus,
   * turns the helix to it and lets it write the cards for that same focus — and the world disposes
   * it. `onRelease` runs when the world lets it go on its own (an error in the helix's frame).
   * Null disposes the one attached (the scene is going).
   */
  attachWork(driver: WorkHelixDriver | null, onRelease?: () => void): void;
  /** The helix's mode as the last frame drew it: the driver's, `off` without one. */
  helixMode(): SceneHelixMode;
  setLite(lite: boolean): void;
  setPalette(palette: ScenePalette): void;
  dispose(): void;
};

/**
 * The hologram follows the focus with this much hysteresis past a card's half-way point:
 * resting between two cards never flips its texture back and forth.
 */
export const HOLOGRAM_HYSTERESIS = 0.3;

/** A scroll of this many viewports a second is `speed` 1 for the helix (`HelixFrame.speed`). */
export const SCROLL_SPEED_FULL = 1.6;
/** …and it falls back to a still page at this rate (about a third of a second), never up. */
export const SCROLL_SPEED_LAMBDA = 4.5;

/** What `stageHelix` needs of the world. */
export type HelixStaging = Pick<SceneWorld, "buildHelix" | "helixObjects" | "prewarm" | "markHelixBuilt">;

/**
 * Work's helix: built in an idle slice of its own, compiled one draw object per idle slice, queued
 * for a pre-warm frame, then marked built. Resolves `true` once built, `false` when cancelled
 * part-way. This IS the scene's staged build: `SceneWorld.tsx` arms ready once it resolves.
 */
export async function stageHelix(
  world: HelixStaging,
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  options: StagedOptions,
): Promise<boolean> {
  const idle = options.idle ?? (() => nextIdle());
  await idle();
  if (options.cancelled()) return false;
  world.buildHelix();
  const compiled = await compileStaged(renderer, scene, camera, [world.helixObjects()], {
    ...options,
    compiled: (objects) => world.prewarm(objects),
  });
  if (!compiled) return false;
  world.markHelixBuilt();
  return true;
}

/** Only the root: the helix comes from `buildHelix`, in an idle slice (`stageHelix`). */
export function createSceneWorld(tier: SceneCanvasTier, initialPalette: ScenePalette): SceneWorld {
  const config = SCENE_TIER_CONFIG[tier];
  const root = new Group();
  root.name = "scene-root";
  // Nothing draws until the helix is pre-warmed (see `prewarm`).
  root.visible = false;

  /** The palette and the lite step as they are now: the helix, built later, starts from them. */
  let palette = initialPalette;
  let lite = false;

  /* Work: the helix, its hologram and the spiral driver the page hands over. */
  let helix: HelixModel | null = null;
  let helixDone = false;
  /** An error in the helix's frame: hidden, the driver gone, for the rest of this canvas's life. */
  let helixFailed = false;
  let hologram: HologramSource | null = null;
  let driver: WorkHelixDriver | null = null;
  let onWorkRelease: (() => void) | undefined;
  /** The mode the helix was last set to, the card it is coloured after, the hologram's card. */
  let drawnMode: SceneHelixMode = "off";
  let accentCard: HTMLElement | null = null;
  let hologramIndex = -1;
  /** The hologram box the plane was last laid out for (zone width, zone height, px per model unit). */
  const hologramBox = { w: -1, h: -1, pxPerUnit: -1 };

  const plan = createHelixComposition();
  const prewarmQueue = new Set<Object3D>();
  const helixSpot: Placement = { x: 0, y: 0, scale: 1 };
  /** The band the helix's arrival is armed over, re-derived from the probe's boxes every frame. */
  const arriveSpan = { start: 0, end: 0 };
  const helixFrame: HelixFrame = {
    time: 0,
    step: 0,
    focus: 0,
    reveal: 0,
    tx: 0,
    ty: 0,
    prewarm: false,
    halfHeightPx: 1,
    dpr: 1,
    exit: 0,
    arrive: 1,
    speed: 0,
  };
  /** The scroll's own speed, smoothed: 0 still → 1 at `SCROLL_SPEED_FULL` viewports a second. */
  let scrollSpeed = 0;
  let lastScrollY = Number.NaN;

  /** The part (a direct child of the root) an object belongs to. */
  const partOf = (object: Object3D): Object3D => {
    let node = object;
    while (node.parent && node.parent !== root) node = node.parent;
    return node;
  };

  /** Let the driver go: it puts every card back as React rendered it; `onRelease` hears of it. */
  const releaseWork = () => {
    const released = driver;
    const onRelease = onWorkRelease;
    driver = null;
    onWorkRelease = undefined;
    accentCard = null;
    hologramIndex = -1;
    if (!released) return;
    try {
      released.dispose();
    } catch {
      // the driver restores what it can on its own; the scene goes on without it
    }
    onRelease?.();
  };

  /**
   * The helix's frame threw. A `useFrame` error never reaches the stage's error boundary, so the
   * cards would stay laid out round a helix that no longer turns: the page comes first.
   */
  const failHelix = (error: unknown) => {
    if (helixFailed) return;
    helixFailed = true;
    releaseWork();
    if (helix) helix.group.visible = false;
    drawnMode = "off";
    console.error("3D scene: the Work helix stopped", error);
  };

  /**
   * The helix this frame: the driver's mode, the focus it turns to, where it sits, its colour (the
   * front card's `--p2`) and the hologram's card. Drawn while the work gate reveals it.
   */
  const frameHelix = (
    scrollY: number,
    w: number,
    h: number,
    probe: ScrollProbe,
    fx: SceneFx,
    step: number,
    halfHeightPx: number,
    dpr: number,
  ): void => {
    helixFrame.focus = 0;
    if (!helix || helixFailed) return;
    const group = helix.group;
    const prewarm = prewarmQueue.has(group);
    const mode: SceneHelixMode = driver && helixDone ? driver.mode() : "off";
    if (mode !== drawnMode) {
      drawnMode = mode;
      if (mode !== "off") helix.setMode(mode);
      if (mode !== "spiral") hologramIndex = -1;
    }
    const focus = mode === "spiral" && driver ? driver.focus(scrollY) : 0;
    helixFrame.focus = focus;
    helixFrame.exit = mode === "spiral" && driver ? driver.exit(scrollY) : 0;
    // A fling that leaves the whole track inside the gate's 1.2s must not play an arrival under a
    // finish that is already winding up: past the last card the helix is simply there, then gone.
    helixFrame.arrive = helixFrame.exit > 0 ? 1 : plan.helixArrive;
    helixFrame.speed = scrollSpeed;
    const place =
      mode === "spiral"
        ? placeHelixSpiral(probe, scrollY, w, h, HELIX_LAYOUT.cx, helixSpot)
        : mode === "ambient"
          ? placeHelixAmbient(probe, scrollY, w, h, helixSpot)
          : null;
    const reveal = place ? plan.helix : 0;
    if (place && mode !== "off") {
      group.position.set(place.x, place.y, 0);
      group.scale.setScalar(place.scale);
      // The hologram beside it, on the spiral layout's box: `holo` of the zone, centre and width.
      const zoneW = probe.work?.w ?? w;
      const zoneH = probe.layerH > 0 ? probe.layerH : h;
      const pxPerUnit = place.scale / worldPerPx(h);
      if (mode === "spiral" && (zoneW !== hologramBox.w || zoneH !== hologramBox.h || pxPerUnit !== hologramBox.pxPerUnit)) {
        hologramBox.w = zoneW;
        hologramBox.h = zoneH;
        hologramBox.pxPerUnit = pxPerUnit;
        const holo = HELIX_LAYOUT.holo;
        layoutHelixHologram(
          group,
          (holo.x - HELIX_LAYOUT.cx) * zoneW,
          (0.5 - holo.y) * zoneH,
          Math.min(holo.w[0] * zoneW, holo.w[1]),
          pxPerUnit,
        );
      }
    }

    if (driver && mode !== "off") {
      // Coloured after the front card: the focus in the spiral, the card nearest the middle in the band.
      const cards = driver.cards();
      const card = cards[driver.front()] ?? null;
      if (card !== accentCard) {
        accentCard = card;
        const rgb = card ? parseTokenColor(card.style.getPropertyValue("--p2")) : null;
        helix.setAccent(rgb ? toColor(rgb) : null);
        // A project has arrived at the front: the strands answer it — the first one included.
        // It cannot be spent off screen: the driver marks no card at all while the focus is under
        // −0.5 (workHelix.ts `frameSpiral`), so card 0 takes the front half a step below it, well
        // inside the layer, and its flare lands with the arrival's own.
        if (card) helix.pulse();
      }
      // The hologram shows the focused card, redrawn once the focus is well past half-way.
      if (mode === "spiral" && reveal > 0 && cards.length > 0) {
        const wanted = Math.min(cards.length - 1, Math.max(0, Math.round(focus)));
        // `focus` runs on past the last card through the finish: never re-compose the same one.
        if (wanted !== hologramIndex && (hologramIndex < 0 || Math.abs(focus - hologramIndex) > 0.5 + HOLOGRAM_HYSTERESIS)) {
          hologramIndex = wanted;
          if (!hologram) {
            // Handed to the model on its first drawn card (no empty frame before), glitching every swap.
            const model = helix;
            let handed = false;
            const source = createHologramSource(config.hologram, () => {
              if (!handed) {
                handed = true;
                model.setHologram(source.texture);
              }
              model.glitch();
            });
            hologram = source;
          }
          hologram.request(cards[hologramIndex] ?? null, hologramIndex);
        }
      }
    }

    if (reveal > 0 || prewarm) {
      helixFrame.time = fx.time;
      helixFrame.step = step;
      helixFrame.reveal = reveal;
      helixFrame.tx = fx.tx;
      helixFrame.ty = fx.ty;
      helixFrame.prewarm = prewarm;
      helixFrame.halfHeightPx = halfHeightPx;
      helixFrame.dpr = dpr;
      helix.update(helixFrame);
    } else {
      group.visible = false;
    }
  };

  return {
    root,

    buildHelix() {
      if (helix) return;
      helix = createHelixModel(config, palette);
      helix.setLite(lite);
      helix.group.visible = false;
      if (!helix.group.name) helix.group.name = "scene-helix";
      root.add(helix.group);
    },

    helixObjects() {
      return helix ? helix.objects : [];
    },

    prewarm(objects) {
      for (const object of objects) prewarmQueue.add(partOf(object));
      if (objects.length > 0) root.visible = true;
    },

    markHelixBuilt() {
      if (helix) helixDone = true;
    },

    helixBuilt() {
      return helixDone && !helixFailed;
    },

    update(dt, scrollY, view, probe, fx) {
      const w = view.size.width;
      const h = view.size.height;
      const dpr = view.viewport.dpr;

      // The scroll's speed, in viewports a second, eased so a flick decays instead of flickering.
      if (dt > 0 && Number.isFinite(lastScrollY) && h > 0) {
        const rate = Math.abs(scrollY - lastScrollY) / dt / h / SCROLL_SPEED_FULL;
        const target = rate > 1 ? 1 : rate;
        scrollSpeed = target > scrollSpeed ? target : damp(scrollSpeed, target, SCROLL_SPEED_LAMBDA, dt);
      }
      lastScrollY = scrollY;

      // The work gate only ever opens onto a helix that can be drawn: built, and a mode applied.
      const helixMode = helixDone && !helixFailed && driver ? driver.mode() : "off";
      // The arrival arms on the spiral's own sticky line, where the helix is all but centred in
      // the layer (`helixArriveSpan`). The ambient helix has no sticky zone — it lies in the band
      // above Work's heading, a screen higher up the page — so there it keeps Work's own band.
      const workSpan =
        helixMode === "spiral"
          ? helixArriveSpan(probe, arriveSpan)
          : helixMode === "ambient" && probe.live && probe.work
            ? probe.workSpan
            : null;
      const step = stepSceneFx(fx, dt, scrollY, workSpan);
      composeHelix(fx.work.value, plan);

      /* Work's helix: on its sticky zone (spiral) or in the band above the heading (ambient) */
      try {
        frameHelix(scrollY, w, h, probe, fx, step, h * dpr * 0.5, dpr);
      } catch (error) {
        failHelix(error);
      }

      prewarmQueue.clear();

      /* the cards, laid out for the focus the helix just turned to (nothing before it is built) */
      if (driver) {
        try {
          driver.write({ focus: helixFrame.focus, built: helixDone && !helixFailed });
        } catch (error) {
          failHelix(error);
        }
      }
    },

    attachWork(next, onRelease) {
      if (next === driver) return;
      releaseWork();
      if (!next) return;
      if (helixFailed) {
        try {
          next.dispose();
        } catch {
          // nothing was laid out yet
        }
        return;
      }
      driver = next;
      onWorkRelease = onRelease;
    },

    helixMode() {
      return drawnMode;
    },

    setLite(next) {
      lite = next;
      helix?.setLite(lite);
    },

    setPalette(next) {
      palette = next;
      helix?.setPalette(next);
    },

    dispose() {
      releaseWork();
      helix?.dispose();
      hologram?.dispose();
      root.clear();
    },
  };
}
