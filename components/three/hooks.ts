"use client";

/**
 * The R3F glue every scene on the site repeats: a renderer factory that never throws, a
 * "ready" signal once shaders are compiled and frames are on screen, and a renderer that is
 * disposed after unmount. Hooks only — each scene decides what "lost" and "ready" mean.
 */

import type { RootState } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Camera, Scene, WebGLRenderer } from "three";
import { compileScene, createRenderer, retainRenderer } from "./renderer";

export type RendererFactory = {
  /** For `<Canvas gl>`. R3F's web canvas always hands over an HTMLCanvasElement. */
  gl(defaults: { canvas: unknown }): Promise<WebGLRenderer>;
  /** For `<Canvas onCreated>`: a context lost later is reported too. */
  onCreated(state: RootState): void;
};

/**
 * `onLost` fires at most once, and only while mounted: once unmounted, a context loss is our
 * own teardown (R3F forces it 500ms after unmount), not a failure. A refused context never
 * settles the factory's promise, so R3F stops configuring the root and the owner unmounts it.
 */
export function useRendererFactory({
  antialias,
  force3d,
  powerPreference,
  onLost,
}: {
  antialias: boolean;
  force3d: boolean;
  powerPreference?: WebGLPowerPreference;
  onLost: () => void;
}): RendererFactory {
  const mounted = useRef(false);
  const lostReported = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reportLost = useCallback(() => {
    if (!mounted.current || lostReported.current) return;
    lostReported.current = true;
    onLost();
  }, [onLost]);

  const gl = useCallback(
    async (defaults: { canvas: unknown }) => {
      const renderer = createRenderer(defaults.canvas as HTMLCanvasElement, {
        antialias,
        force3d,
        powerPreference,
      });
      if (renderer) return renderer;
      reportLost();
      // Never settle: R3F stops configuring this root, and the owner unmounts it.
      return new Promise<never>(() => {});
    },
    [antialias, force3d, powerPreference, reportLost],
  );

  const onCreated = useCallback(
    ({ gl: renderer }: RootState) => {
      renderer.domElement.addEventListener(
        "webglcontextlost",
        (event) => {
          event.preventDefault();
          reportLost();
        },
        { once: true },
      );
    },
    [reportLost],
  );

  return useMemo(() => ({ gl, onCreated }), [gl, onCreated]);
}

/**
 * `onReady` once every shader in `scene` has compiled and two frames have been presented, so
 * the owner cross-fades in a scene that is already drawing — never a blank or hitching canvas.
 */
export function useSceneReady(
  gl: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  onReady: () => void,
): void {
  const latest = useRef(onReady);
  useEffect(() => {
    latest.current = onReady;
  }, [onReady]);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    void compileScene(gl, scene, camera).then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (!cancelled) latest.current();
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [gl, scene, camera]);
}

/** Dispose `gl` after its canvas unmounts (deferred a tick: see `retainRenderer`). */
export function useRetainedRenderer(gl: WebGLRenderer): void {
  useEffect(() => retainRenderer(gl), [gl]);
}
