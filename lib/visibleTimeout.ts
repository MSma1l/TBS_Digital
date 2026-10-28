/**
 * `setTimeout` that only counts while the tab is visible.
 *
 * A plain timer keeps counting in a hidden tab; this one waits until the visitor can see the
 * page, so a deadline is never spent while nobody is watching.
 *
 * Returns a cancel function; it is safe to call more than once. The callback fires at most
 * once: firing also drops the visibility listener, so a later hide/show cannot re-arm it.
 * No DOM access at import time, so server modules can import it.
 */
export function visibleTimeout(ms: number, onFire: () => void): () => void {
  let remaining = ms;
  let startedAt = 0;
  let id: number | undefined;
  let finished = false;

  const start = () => {
    if (finished || id !== undefined) return;
    startedAt = performance.now();
    id = window.setTimeout(fire, Math.max(0, remaining));
  };
  const pause = () => {
    if (id === undefined) return;
    window.clearTimeout(id);
    id = undefined;
    remaining -= performance.now() - startedAt;
  };
  const onVisibility = () => (document.visibilityState === "hidden" ? pause() : start());
  const cancel = () => {
    finished = true;
    pause();
    document.removeEventListener("visibilitychange", onVisibility);
  };
  function fire() {
    id = undefined;
    cancel();
    onFire();
  }

  document.addEventListener("visibilitychange", onVisibility);
  if (document.visibilityState !== "hidden") start();
  return cancel;
}
