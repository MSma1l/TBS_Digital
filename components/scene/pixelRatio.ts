/**
 * When the interior canvas's DPR range must be worked out again (tiers.ts `clampSceneDpr`):
 *  · the window was resized — a 2× laptop that mounted the page in a narrow window and then
 *    maximised it would otherwise draw ~1.5× the tier's pixel budget, until the FPS governor
 *    stepped in; debounced like the canvas's own resize;
 *  · the page moved to a screen with another pixel ratio (a window dragged from a 1× monitor to
 *    a 2× one stayed blurry). `(resolution: Ndppx)` stops matching the moment the ratio
 *    changes, so the query is re-armed for the new ratio after every change.
 *
 * Plain listeners, no React: SceneCanvas re-reads the range in the callback.
 */

export type PixelRatioHost = Pick<Window, "addEventListener" | "removeEventListener" | "matchMedia"> & {
  devicePixelRatio: number;
  setTimeout(handler: () => void, ms: number): number;
  clearTimeout(id: number | undefined): void;
};

/** Call `onChange` after a debounced resize or a pixel-ratio change. Returns the cleanup. */
export function watchPixelRatio(
  onChange: () => void,
  debounceMs: number,
  host: PixelRatioHost = window,
): () => void {
  let timer: number | undefined;
  const onResize = () => {
    host.clearTimeout(timer);
    timer = host.setTimeout(onChange, debounceMs);
  };
  host.addEventListener("resize", onResize, { passive: true });

  let media: MediaQueryList | null = null;
  const stopMedia = () => {
    media?.removeEventListener?.("change", onResolution);
    media = null;
  };
  const armMedia = () => {
    stopMedia();
    if (typeof host.matchMedia !== "function") return;
    try {
      media = host.matchMedia(`(resolution: ${host.devicePixelRatio}dppx)`);
      media.addEventListener?.("change", onResolution);
    } catch {
      media = null;
    }
  };
  function onResolution() {
    armMedia();
    onChange();
  }
  armMedia();

  return () => {
    host.removeEventListener("resize", onResize);
    host.clearTimeout(timer);
    stopMedia();
  };
}
