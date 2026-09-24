import type { ReactElement, ReactNode } from "react";
import type { SceneShape } from "@/lib/scene";
import { serviceArtPaths } from "./serviceArtPaths";
import s from "./ServiceArt.module.css";

/**
 * The static illustration of each direction's model — what every device without the WebGL
 * scene (no capable GPU, Save-Data, reduced motion, a low-tier phone) sees on the Directions
 * HUD screen, and what the canvas crossfades from.
 *
 * Pure components: no hooks, no directive, no randomness, so the same module renders on both
 * sides. app/(site)/page.tsx server-renders the drawing of the direction `Directions` opens on
 * and hands it down as a slot (it ships in the HTML and, as a prop, in the RSC payload — one
 * drawing, not five). `Directions` loads this module in the browser the first time another
 * direction is selected and draws that one from the scene's shapes (./serviceArtPaths.ts builds
 * a direction's table on first use). It renders the selected illustration keyed, so each
 * selection replays the one-shot entrance.
 *
 * Purely decorative: `aria-hidden`, no text, no `<title>`, nothing focusable.
 */

const cx = (...names: string[]) => names.join(" ");

function Art({ shape, children }: { shape: SceneShape; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-shape-art={shape}
      viewBox="-100 -100 200 200"
      className={s.art}
    >
      {children}
    </svg>
  );
}

/**
 * Produs digital: the product stack — six app screens standing apart over a bench, collapsing
 * into the device slab in front of them. The same object `models/productStack.ts` builds, at the
 * composed pose a service page opens on, so the cross-fade to the live model lands on one
 * silhouette instead of swapping one drawing for a different one.
 */
function stackArt() {
  const d = serviceArtPaths("produs-digital");
  return (
    <Art shape="produs-digital">
      <path d={d.plate} className={cx(s.hair, s.dash)} />
      <path d={d.grid} className={s.hair} />
      <path d={d.stackSide} className={cx(s.line, s.side)} />
      <path d={d.stackFront} className={cx(s.line, s.front)} />
      <path d={d.stackTop} className={cx(s.line, s.top)} />
      <path d={d.stackGlass} className={s.glass} />
      <path d={d.flow} className={cx(s.line, s.hot, s.thick)} />
      <path d={d.deviceSide} className={cx(s.line, s.side)} />
      <path d={d.deviceFront} className={cx(s.line, s.front)} />
      <path d={d.deviceTop} className={cx(s.line, s.top)} />
      <path d={d.glass} className={cx(s.line, s.glass, s.lit)} />
      <path d={d.rules} className={s.hair} />
    </Art>
  );
}

/** E-commerce: the Offer → Payment → Access loop, packets riding each leg. */
function commerceArt() {
  const d = serviceArtPaths("e-commerce");
  return (
    <Art shape="e-commerce">
      <path d={d.inner} className={cx(s.hair, s.dash)} />
      <path d={d.back} className={s.hair} />
      <path d={d.front} className={s.line} />
      <path d={d.legOffer} className={cx(s.line, s.bar)} />
      <path d={d.legPayment} className={cx(s.line, s.blue, s.bar)} />
      <path d={d.legAccess} className={cx(s.line, s.hot, s.bar)} />
      <path d={d.chevrons} className={cx(s.line, s.bold)} />
      <path d={d.gateOffer} className={cx(s.line, s.bold, s.glass, s.hoop)} />
      <path d={d.gatePayment} className={cx(s.line, s.blue, s.bold, s.glass, s.hoop)} />
      <path d={d.gateAccess} className={cx(s.line, s.hot, s.bold, s.glass, s.hoop)} />
    </Art>
  );
}

/** Automatizare & API: a hub wired to its systems (database, API, queue, service). */
function hubArt() {
  const d = serviceArtPaths("automatizare-api");
  return (
    <Art shape="automatizare-api">
      <path d={d.plate} className={cx(s.hair, s.dash)} />
      <path d={d.orbit} className={s.hair} />
      <path d={d.backLinks} className={s.hair} />
      <path d={d.backHulls} className={s.glass} />
      <path d={d.backGlyphs} className={s.hair} />
      <path d={d.core} className={cx(s.line, s.hot, s.core)} />
      <path d={d.wire} className={s.line} />
      <path d={d.frontLinks} className={s.line} />
      <path d={d.frontHulls} className={s.glass} />
      <path d={d.frontGlyphs} className={s.line} />
      <path d={d.packetsOut} className={cx(s.line, s.thick)} />
      <path d={d.packetsIn} className={cx(s.line, s.hot, s.thick)} />
    </Art>
  );
}

/** Asistenți IA: a layered network with one impulse travelling through it. */
function neuralArt() {
  const d = serviceArtPaths("asistenti-ia");
  return (
    <Art shape="asistenti-ia">
      <path d={d.plate} className={cx(s.hair, s.dash)} />
      <path d={d.rings} className={s.hair} />
      <path d={d.edges} className={s.hair} />
      <path d={d.impulse} className={cx(s.line, s.bold)} />
      <path d={d.nodes} className={cx(s.line, s.node)} />
      <path d={d.active} className={cx(s.line, s.lit)} />
      <path d={d.output} className={cx(s.line, s.hot, s.bold, s.core)} />
    </Art>
  );
}

/** Brand & UI: a wireframe wave with interface cards floating over it. */
function meshArt() {
  const d = serviceArtPaths("brand-ui");
  return (
    <Art shape="brand-ui">
      <path d={d.rowsFar} className={s.hair} />
      <path d={d.cols} className={s.hair} />
      <path d={d.rowsNear} className={cx(s.line, s.blue)} />
      <path d={d.pulse} className={cx(s.line, s.hot, s.bold)} />
      <path d={d.drops} className={cx(s.hair, s.dash)} />
      <path d={d.frameFar} className={cx(s.line, s.glass)} />
      <path d={d.contentFar} className={s.line} />
      <path d={d.frameMid} className={cx(s.line, s.glass)} />
      <path d={d.contentMid} className={s.line} />
      <path d={d.frameNear} className={cx(s.line, s.glass)} />
      <path d={d.contentNear} className={s.line} />
    </Art>
  );
}

/** One drawing per direction, in the scene's order. Plain functions (no hooks): each builds its
 *  path table on first use. */
export const SERVICE_DRAWINGS: Readonly<Record<SceneShape, () => ReactElement>> = {
  "produs-digital": stackArt,
  "e-commerce": commerceArt,
  "automatizare-api": hubArt,
  "asistenti-ia": neuralArt,
  "brand-ui": meshArt,
};

/** The selected direction's illustration. */
export function ServiceArt({ shape }: { shape: SceneShape }) {
  return SERVICE_DRAWINGS[shape]();
}
