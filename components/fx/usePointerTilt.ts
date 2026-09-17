"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { mediaMatches } from "@/lib/device";
import { REDUCED_MOTION_QUERY, TILT_QUERY, shouldTilt, tiltFor, type TiltRect } from "@/lib/tilt";

export type PointerTiltHandlers = {
  onPointerEnter(event: ReactPointerEvent<HTMLElement>): void;
  onPointerMove(event: ReactPointerEvent<HTMLElement>): void;
  onPointerLeave(event: ReactPointerEvent<HTMLElement>): void;
  onPointerCancel(event: ReactPointerEvent<HTMLElement>): void;
};

/** The element being tilted right now (one per hook: a pointer is over one card at a time). */
type Active = {
  el: HTMLElement;
  rect: TiltRect;
  x: number;
  y: number;
  frame: number;
  onScroll: () => void;
};

function subscribeTiltMedia(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const lists = [window.matchMedia(TILT_QUERY), window.matchMedia(REDUCED_MOTION_QUERY)];
  for (const list of lists) list.addEventListener?.("change", onChange);
  return () => {
    for (const list of lists) list.removeEventListener?.("change", onChange);
  };
}

const canTilt = () => mediaMatches(TILT_QUERY) && !mediaMatches(REDUCED_MOTION_QUERY);
const canTiltOnServer = () => false;

function measure(el: HTMLElement): TiltRect {
  const { left, top, width, height } = el.getBoundingClientRect();
  return { left, top, width, height };
}

/** Put the card back: no tilt variables, no `data-tilting`, and no empty `style` husk. */
function settle(active: Active): void {
  if (active.frame) cancelAnimationFrame(active.frame);
  window.removeEventListener("scroll", active.onScroll);
  active.el.removeAttribute("data-tilting");
  active.el.style.removeProperty("--tilt-rx");
  active.el.style.removeProperty("--tilt-ry");
  if (active.el.getAttribute("style")?.trim() === "") active.el.removeAttribute("style");
}

/**
 * A 3D pointer tilt for cards, DOM-only: the handlers write `--tilt-rx` / `--tilt-ry` (deg)
 * and `data-tilting` on the element they are attached to (`currentTarget`), coalesced to one
 * write per animation frame; CSS turns them into a transform. One hook can serve a whole grid.
 *
 * Only a mouse on a fine, hovering pointer tilts, never under reduced motion. `enabled` is
 * for `data-tilt="on|off"`; it is `false` on the server and while hydrating.
 *
 * The rect is measured on enter (and again on scroll), not per move: a tilted card's own
 * bounding box changes as it tilts, which would feed back into the angle.
 */
export function usePointerTilt(maxDeg: number): {
  enabled: boolean;
  handlers: PointerTiltHandlers;
} {
  const enabled = useSyncExternalStore(subscribeTiltMedia, canTilt, canTiltOnServer);
  const active = useRef<Active | null>(null);

  const stop = useCallback(() => {
    const current = active.current;
    if (!current) return;
    active.current = null;
    settle(current);
  }, []);

  const start = useCallback(
    (event: ReactPointerEvent<HTMLElement>): Active | null => {
      const tilts = shouldTilt({
        reducedMotion: mediaMatches(REDUCED_MOTION_QUERY),
        finePointer: mediaMatches(TILT_QUERY),
        pointerType: event.pointerType,
      });
      if (!tilts) return null;
      const el = event.currentTarget;
      if (active.current?.el === el) return active.current;
      stop();
      const next: Active = {
        el,
        rect: measure(el),
        x: event.clientX,
        y: event.clientY,
        frame: 0,
        onScroll: () => {
          next.rect = measure(el);
        },
      };
      window.addEventListener("scroll", next.onScroll, { passive: true });
      active.current = next;
      return next;
    },
    [stop],
  );

  const handlers = useMemo<PointerTiltHandlers>(
    () => ({
      onPointerEnter: (event) => {
        start(event);
      },
      onPointerMove: (event) => {
        const current = start(event);
        if (!current) return;
        current.x = event.clientX;
        current.y = event.clientY;
        if (current.frame) return;
        current.frame = requestAnimationFrame(() => {
          current.frame = 0;
          if (active.current !== current) return;
          const { rx, ry } = tiltFor(current.x, current.y, current.rect, maxDeg);
          current.el.style.setProperty("--tilt-rx", `${rx}deg`);
          current.el.style.setProperty("--tilt-ry", `${ry}deg`);
          current.el.setAttribute("data-tilting", "");
        });
      },
      onPointerLeave: () => stop(),
      onPointerCancel: () => stop(),
    }),
    [maxDeg, start, stop],
  );

  useEffect(() => stop, [stop]);

  return { enabled, handlers };
}
