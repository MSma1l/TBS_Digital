/**
 * "The visitor is busy with the HUD right now" — an OS window in use, a module being dragged.
 * The guide reads it as one of its blockers, so a prompt never pops up over a window someone
 * is working in.
 *
 * A module-level store, not a `window` event: producers and consumers live in lazy HUD chunks
 * of the same bundle, and `useSyncExternalStore(subscribeHudBusy, isHudBusy, () => false)`
 * reads it directly. Each source is a flag of its own, so one producer letting go never clears
 * another's. Subscribers hear only the aggregate flipping (not busy ↔ busy), like
 * `subscribePageCover` in lib/scrollLock.ts.
 *
 * Client only: writes on the server are ignored, so no request can leave state behind for the
 * next one. No DOM access at import time.
 */

export type HudBusySource = "os-window" | "os-drag";

const active = new Set<HudBusySource>();
const listeners = new Set<() => void>();

/** Mark `source` busy or not. Listeners run only when `isHudBusy()` changes. */
export function setHudBusy(source: HudBusySource, busy: boolean): void {
  if (typeof window === "undefined") return;
  const before = active.size > 0;
  if (busy) active.add(source);
  else active.delete(source);
  if ((active.size > 0) === before) return;
  // A copy: a listener may unsubscribe (or subscribe another) while it runs.
  for (const listener of [...listeners]) listener();
}

/** Is any source busy? `false` on the server. */
export function isHudBusy(): boolean {
  return active.size > 0;
}

/** Called on every not busy ↔ busy change (read `isHudBusy()` inside). Returns the unsubscribe. */
export function subscribeHudBusy(cb: () => void): () => void {
  // Wrapped, so subscribing the same function twice gives two independent subscriptions.
  const entry = () => cb();
  listeners.add(entry);
  return () => {
    listeners.delete(entry);
  };
}

/** Unit tests only: nothing busy, nobody listening. */
export function resetHudBusyForTests(): void {
  active.clear();
  listeners.clear();
}
