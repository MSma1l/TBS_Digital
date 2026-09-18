/**
 * The Work spiral's DOM driver: turns the project cards React already rendered into a sticky
 * spiral around the helix, and back. Framework-free on purpose — no React, no three.js — so the
 * scene chunk (`SceneWorld`) creates it, calls `write` once per frame after the world, and
 * disposes it with the scene. React never learns anything happened.
 *
 * Modes (`want`): `spiral` with the helix built, at least `HELIX_MIN_CARDS` cards and
 * `WORK_HELIX_MEDIA`; `ambient` with the helix built otherwise (the grid or band stays, the
 * card nearest the middle is marked); `off` before it is built, after `dispose`, after an error,
 * or without IntersectionObserver / matchMedia.
 *
 * - **Into the spiral only while Work is below the viewport**: the section's rect, read in the
 *   frame that would lay it out (an IntersectionObserver on the section only vetoes while it says
 *   Work is on screen — it never fires for an instant jump straight across Work). The track grows
 *   by thousands of px; below the visitor it moves nothing they see. A deep link into Work keeps
 *   the grid until they are back above it.
 * - **Out of it at once** (media, fewer cards, `built` false, dispose, an error), with the scroll
 *   put back under the visitor: inside the spiral, to the focused card's grid position
 *   (`top − headerH − 24`, instant); past its end, keeping whatever follows the track still.
 * - **Every property is inline and every original `style` attribute comes back byte for byte**
 *   (`--p1/--p2` exactly as React rendered them). Should someone else have changed the style
 *   meanwhile (a tilt in progress, new admin colours), only the driver's own longhands go.
 * - **A card is never capped below its content**: the spiral writes `min-height`, never `height`
 *   (the cards clip with `overflow: hidden`, and a touch screen always shows the description), and
 *   centres each card's measured box under the header — a card taller than the layer starts right
 *   under it. A ResizeObserver on the cards centres them again when their content changes.
 * - React re-renders (a locale switch) diff only React's own style keys, so the inline layout
 *   survives them; a re-keyed card list (`/api/content`) is re-collected through a
 *   MutationObserver on the track's children and laid out again.
 * - Focus: tabbing to a card scrolls to where it is the focus (the page's own smooth scrolling
 *   applies). Tab order, `inert` and `aria-hidden` are never touched; a card that holds focus is
 *   fully opaque. A focus a pointer press caused scrolls nothing (the press would land elsewhere).
 * - Any exception inside the driver restores everything and leaves it `off` for good.
 */

import { scrollProgress, type ScrollProbe, type ScrollSpan } from "@/lib/scene";
import {
  HELIX_FRONT_ATTR,
  HELIX_LAYOUT,
  HELIX_LIT_ATTR,
  HELIX_MIN_CARDS,
  WORK_HELIX_MEDIA,
  createCardPose,
  focusFromProgress,
  helixCardHeight,
  helixCardWidth,
  helixExitAt,
  helixExitLength,
  helixFocusAt,
  helixForm,
  helixLayout,
  helixOutro,
  helixStep,
  nearestCard,
  scrollForCard,
  wantedHelixMode,
  type CardPhase,
  type CardRect,
} from "./helix";

export type WorkHelixMode = "off" | "spiral" | "ambient";

export type WorkHelixDriver = {
  /**
   * Scroll → the pose focus from the driver's own measured span; 0 when not spiral. 0..n−1 over
   * the cards, then on past n−1 at the same rate through the finish (helix.ts `helixFocusAt`), so
   * the helix the world turns to it never stalls. `front()` and the hologram clamp it.
   */
  focus(scrollY: number): number;
  /** How far into the finish `scrollY` is, 0..1 (helix.ts `helixExitAt`); 0 when not spiral. */
  exit(scrollY: number): number;
  /**
   * Once per frame after world.update: applies the wanted mode when safe, writes poses (spiral) or
   * the nearest card (ambient). `enter` is the Work gate's timed 0 → 1 (fx.ts); left out it is 1,
   * fully formed.
   */
  write(s: { focus: number; built: boolean; enter?: number }): void;
  /** Index of the front card (data-helix-front), −1 if none. */
  front(): number;
  cards(): readonly HTMLElement[];
  mode(): WorkHelixMode;
  /** Restore everything (styles, attributes, listeners), compensate the scroll if Work was on screen in spiral; onMode("off"). */
  dispose(): void;
};

export type WorkHelixOptions = {
  /** `[data-work-track]`: the grid of cards in Work.tsx. */
  track: HTMLElement;
  /** `#lucrari`. */
  section: HTMLElement;
  /** Read for `headerH`, `layerH`, `live` and `version`. */
  probe: ScrollProbe;
  /** Injectable for tests; `window.matchMedia` otherwise. */
  matchMedia?: (query: string) => MediaQueryList;
  /** Only on a change. */
  onMode(mode: WorkHelixMode): void;
};

/**
 * Everything the spiral writes on a card, so a restore can tell them from anyone else's: the
 * grid placement as longhands, `margin` both ways (engines list it as four longhands or as the
 * shorthand).
 */
const CARD_PROPS = [
  "grid-row-start",
  "grid-column-start",
  "grid-row-end",
  "grid-column-end",
  "align-self",
  "justify-self",
  "position",
  "top",
  "width",
  "min-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "pointer-events",
  "transition-property",
  "transform",
  "z-index",
  "opacity",
] as const;

/** Everything the spiral writes on the track. */
const TRACK_PROPS = ["display", "grid-template-columns", "grid-template-rows"] as const;

/** Set once on entry; the per-frame ones (transform, z-index, opacity, pointer-events) follow. */
const CARD_STATIC: ReadonlyArray<readonly [string, string]> = [
  ["grid-row-start", "1"],
  ["grid-column-start", "1"],
  ["grid-row-end", "auto"],
  // Also cancels Work's `col-span-2` on an odd last card (≤900px): one column, one cell.
  ["grid-column-end", "auto"],
  ["align-self", "start"],
  ["justify-self", "center"],
  ["position", "sticky"],
  ["margin", "0px"],
  ["pointer-events", "none"],
  // Work's CARD_CLASSES transition `transform` over 300ms: the cards would trail the helix.
  ["transition-property", "translate, box-shadow, border-color"],
];

/** Where the focused card lands under the header when a spiral is taken apart under the visitor. */
const RESTORE_GAP = 24;
/** A smaller focus change repaints nothing. */
const FOCUS_EPSILON = 1e-4;
/** A focus this soon after a pointer press on the track is the pointer's: no focus scroll. */
const POINTER_FOCUS_MS = 800;

type Saved = { el: HTMLElement; style: string | null; names: string[]; values: string[] };

function save(el: HTMLElement): Saved {
  const names: string[] = [];
  const values: string[] = [];
  for (let i = 0; i < el.style.length; i += 1) {
    const name = el.style.item(i);
    names.push(name);
    values.push(el.style.getPropertyValue(name));
  }
  return { el, style: el.getAttribute("style"), names, values };
}

/**
 * The attribute string itself when nobody but the driver touched the style since `save` —
 * byte for byte, or no attribute at all. Otherwise only the driver's properties go back.
 */
function restore(saved: Saved, ours: readonly string[]): void {
  const style = saved.el.style;
  let untouched = true;
  for (let i = 0; i < saved.names.length && untouched; i += 1) {
    const name = saved.names[i];
    if (!ours.includes(name) && style.getPropertyValue(name) !== saved.values[i]) untouched = false;
  }
  for (let i = 0; i < style.length && untouched; i += 1) {
    const name = style.item(i);
    if (!ours.includes(name) && !saved.names.includes(name)) untouched = false;
  }
  // Read the attribute first: Blink serializes a CSSOM-written style lazily, and removing the
  // attribute while that is pending leaves `style=""` behind on the next read.
  saved.el.getAttribute("style");
  if (untouched) {
    if (saved.style === null) saved.el.removeAttribute("style");
    else saved.el.setAttribute("style", saved.style);
    return;
  }
  for (const name of ours) {
    const at = saved.names.indexOf(name);
    if (at >= 0) style.setProperty(name, saved.values[at]);
    else style.removeProperty(name);
  }
  if (saved.style === null && style.length === 0 && saved.el.getAttribute("style") !== null) {
    saved.el.removeAttribute("style");
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
const deg = (radians: number) => (radians * 180) / Math.PI;

/** Below this written opacity a card is out of the picture, so it takes no pointer either. */
const CLICK_MIN_OPACITY = 0.08;

/** How to put the scroll back after the spiral is taken apart: nothing, a card, or the track's end. */
type ScrollAnchor = { card: number; bottom: number } | null;

export function createWorkHelixDriver(o: WorkHelixOptions): WorkHelixDriver {
  const { track, section, probe, onMode } = o;
  const matchMedia =
    o.matchMedia ??
    (typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? (query: string) => window.matchMedia(query)
      : undefined);
  const supported =
    typeof window !== "undefined" && typeof window.IntersectionObserver === "function" && matchMedia !== undefined;

  let mode: WorkHelixMode = "off";
  /** An error (or a missing API) turned the driver off until dispose. */
  let broken = !supported;
  let disposed = false;
  let built = false;
  let cards = collectCards();
  let front = -1;

  /**
   * Work intersects the viewport, as the IntersectionObserver last said: a veto on entering the
   * spiral, and the ambient index is only worth reading then. Never trusted the other way round —
   * see `isSafe`.
   */
  let visible = false;

  /* spiral */
  let trackSaved: Saved | null = null;
  let cardSaved: Saved[] = [];
  const span: ScrollSpan = { start: 0, end: 0 };
  let zoneW = 0;
  let sceneH = 0;
  /** The finish's own scroll, px: added to the track, taken off the focus span (helix.ts `helixOutro`). */
  let outro = 0;
  /** …and how far it runs for, which is that plus a sticky card's own slack (`helixExitLength`). */
  let exitLength = 0;
  /** The scroll a card of focus costs (`helixStep`), as the current layout measured it. */
  let stepPx = 0;
  /** The probe version the layout (spiral) or the index (ambient) was made for. */
  let version = -1;
  let lastFocus = Number.NaN;
  let lastEnter = Number.NaN;
  const phase: CardPhase = { form: 1, exit: 0 };
  let zIndexes: number[] = [];
  let opacities: number[] = [];
  let clickable: boolean[] = [];
  /** Which cards carry `HELIX_LIT_ATTR`: their arrival has begun (Work's CSS runs it). */
  let lit: boolean[] = [];
  let focused = -1;
  let focusDirty = true;
  /** A card's content box changed (a locale switch, a hover revealing its description): centre them again. */
  let topsDirty = false;
  let resizing: ResizeObserver | null = null;
  let pointerAt = Number.NEGATIVE_INFINITY;
  const pose = createCardPose();

  /* ambient */
  let dirty = true;
  const rects: CardRect[] = [];

  function collectCards(): HTMLElement[] {
    const list: HTMLElement[] = [];
    for (const el of Array.from(track.children)) if (el instanceof HTMLElement) list.push(el);
    return list;
  }

  function setMode(next: WorkHelixMode): void {
    if (next === mode) return;
    mode = next;
    onMode(next);
  }

  function setFront(i: number): void {
    if (i === front) return;
    cards[front]?.removeAttribute(HELIX_FRONT_ATTR);
    front = i;
    cards[i]?.setAttribute(HELIX_FRONT_ATTR, "");
  }

  /**
   * `HELIX_LIT_ATTR` on card `i`, once. Work's CSS hangs the screenshot's reveal off it, so the
   * driver never writes a frame of that animation — only the moment it starts, which is the
   * moment the card's own arrival starts (`helixForm`), staggered card by card along the strand.
   */
  function setLit(i: number, on: boolean): void {
    if (lit[i] === on) return;
    lit[i] = on;
    if (on) cards[i]?.setAttribute(HELIX_LIT_ATTR, "");
    else cards[i]?.removeAttribute(HELIX_LIT_ATTR);
  }

  function clearLit(): void {
    for (let i = 0; i < lit.length; i += 1) if (lit[i]) cards[i]?.removeAttribute(HELIX_LIT_ATTR);
    lit = [];
  }

  function layerHeight(): number {
    return probe.layerH > 0 ? probe.layerH : Math.max(0, window.innerHeight - probe.headerH);
  }

  /* ---- spiral ---------------------------------------------------------------------------- */

  /**
   * SAFE: Work is below the viewport right now. The observer reports intersection changes only, so
   * an instant jump straight across Work (a deep link below it, then the logo back to the top; or
   * the other way) never reaches it, and whatever "below" it last implied goes stale. Its
   * `visible` is only a veto (a stale true clears on its next report, a stale false is caught by
   * the rect); the rect, read in the very frame that would lay the spiral out, decides.
   */
  function isSafe(): boolean {
    if (!probe.live || visible) return false;
    return section.getBoundingClientRect().top >= window.innerHeight;
  }

  function enterSpiral(): void {
    trackSaved = save(track);
    cardSaved = cards.map(save);
    track.style.setProperty("display", "grid");
    track.style.setProperty("grid-template-columns", "100%");
    for (const el of cards) {
      for (const [name, value] of CARD_STATIC) el.style.setProperty(name, value);
    }
    zIndexes = cards.map(() => Number.NaN);
    opacities = cards.map(() => Number.NaN);
    clickable = cards.map(() => false);
    lit = cards.map(() => false);
    lastFocus = Number.NaN;
    lastEnter = Number.NaN;
    focusDirty = true;
    layout();
    if (typeof window.ResizeObserver === "function") {
      resizing = new window.ResizeObserver(() => {
        topsDirty = true;
      });
      for (const el of cards) resizing.observe(el);
    }
  }

  /**
   * Sizes, the tall row and the sticky tops from the current probe; then the span. Entry and a probe
   * refresh only. A card is never given a height: `min-height` keeps the spiral even, and a card
   * whose content is taller (a long description, always shown on a touch screen) grows to fit it —
   * `overflow: hidden` on the card would otherwise cut its text.
   */
  function layout(): void {
    const n = cards.length;
    sceneH = layerHeight();
    zoneW = track.getBoundingClientRect().width;
    outro = helixOutro(window.innerHeight);
    stepPx = helixStep(window.innerHeight);
    exitLength = helixExitLength(window.innerHeight, sceneH);
    const cardW = `${round2(helixCardWidth(zoneW))}px`;
    const cardH = `${round2(helixCardHeight(sceneH))}px`;
    // The finish's scroll is part of the track; `measure` keeps it out of the focus span, so the
    // cards' cadence is `helixStep` each either way.
    track.style.setProperty("grid-template-rows", `${round2(sceneH + (n - 1) * stepPx + outro)}px`);
    for (const el of cards) {
      el.style.setProperty("width", cardW);
      el.style.setProperty("min-height", cardH);
    }
    placeTops();
    measure();
    version = probe.version;
    lastFocus = Number.NaN;
    lastEnter = Number.NaN;
  }

  /**
   * Each card's sticky `top`: its measured box (`offsetHeight`, the content's) centred in the layer
   * under the header — or, when it is taller than the layer, its top right under the header.
   */
  function placeTops(): void {
    topsDirty = false;
    const heights = cards.map((el) => el.offsetHeight);
    for (let i = 0; i < cards.length; i += 1) {
      const h = heights[i] > 0 ? heights[i] : helixCardHeight(sceneH);
      cards[i].style.setProperty("top", `${round2(probe.headerH + Math.max(0, (sceneH - h) / 2))}px`);
    }
  }

  /**
   * The span the focus runs over: track top under the header → track bottom at the viewport's,
   * less the finish's own scroll (`outro`), which the focus runs on through past the last card.
   */
  function measure(): void {
    const box = track.getBoundingClientRect();
    zoneW = box.width;
    span.start = box.top + window.scrollY - probe.headerH;
    span.end = box.bottom + window.scrollY - probe.headerH - sceneH - outro;
  }

  function focusedCard(): number {
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (!active) return -1;
    for (let i = 0; i < cards.length; i += 1) if (cards[i].contains(active)) return i;
    return -1;
  }

  function frameSpiral(focus: number, enter: number): void {
    if (probe.version !== version) layout();
    else if (topsDirty) placeTops();
    if (focusDirty) {
      focusDirty = false;
      const next = focusedCard();
      if (next !== focused) {
        focused = next;
        lastFocus = Number.NaN;
      }
    }
    const f = Number.isFinite(focus) ? focus : 0;
    const e = Number.isFinite(enter) ? Math.min(1, Math.max(0, enter)) : 1;
    // The entrance runs on its own clock, so a still page is repainted while it plays.
    if (Math.abs(f - lastFocus) < FOCUS_EPSILON && e === lastEnter) return;
    lastFocus = f;
    lastEnter = e;
    const n = cards.length;
    // `focus` past the last card is the finish, at `stepPx` of scroll a card: back to 0..1.
    phase.exit = exitLength > 0 ? Math.min(1, Math.max(0, ((f - (n - 1)) * stepPx) / exitLength)) : 0;
    for (let i = 0; i < n; i += 1) {
      const style = cards[i].style;
      phase.form = helixForm(e, i, f);
      helixLayout(i, f, zoneW, sceneH, pose, phase);
      style.transform =
        `perspective(${HELIX_LAYOUT.camera.depth}px) ` +
        `translate3d(${round2(pose.x)}px, ${round2(pose.y)}px, ${round2(pose.tz)}px) ` +
        `scale(${round4(pose.scale)}) rotateY(${round2(deg(pose.rotY))}deg) rotateX(${round2(deg(pose.rotX))}deg)`;
      if (pose.zIndex !== zIndexes[i]) {
        zIndexes[i] = pose.zIndex;
        style.zIndex = String(pose.zIndex);
      }
      const opacity = i === focused ? 1 : round3(pose.opacity);
      if (opacity !== opacities[i]) {
        opacities[i] = opacity;
        style.opacity = String(opacity);
      }
      // Faded out is not there: a card folding into the helix must not take the click either.
      setLit(i, phase.form > 0);
      const click = pose.face === "front" && opacity >= CLICK_MIN_OPACITY;
      if (click !== clickable[i]) {
        clickable[i] = click;
        style.pointerEvents = click ? "auto" : "none";
      }
    }
    setFront(Math.round(Math.min(n - 1, Math.max(0, f))));
  }

  function anchorBefore(): ScrollAnchor {
    if (!track.isConnected) return null;
    const box = track.getBoundingClientRect();
    // Its start is on screen or below: nothing above the visitor changes.
    if (box.top >= 0) return null;
    // Its end is on screen or passed: keep what follows the track where it is.
    if (box.bottom <= window.innerHeight) return { card: -1, bottom: box.bottom };
    return { card: Math.round(focusFromProgress(scrollProgress(window.scrollY, span), cards.length)), bottom: 0 };
  }

  function anchorAfter(anchor: ScrollAnchor): void {
    if (!anchor || !track.isConnected) return;
    if (anchor.card < 0) {
      const delta = track.getBoundingClientRect().bottom - anchor.bottom;
      if (Math.abs(delta) >= 1) window.scrollTo({ top: window.scrollY + delta, behavior: "instant" });
      return;
    }
    const el = cards[Math.min(anchor.card, cards.length - 1)];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - probe.headerH - RESTORE_GAP;
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  }

  function restoreAll(): void {
    clearLit();
    resizing?.disconnect();
    resizing = null;
    topsDirty = false;
    const savedCards = cardSaved;
    const savedTrack = trackSaved;
    cardSaved = [];
    trackSaved = null;
    for (const saved of savedCards) {
      try {
        restore(saved, CARD_PROPS);
      } catch {
        // keep restoring the others
      }
    }
    if (savedTrack) restore(savedTrack, TRACK_PROPS);
  }

  /* ---- ambient --------------------------------------------------------------------------- */

  const markDirty = () => {
    dirty = true;
  };

  function attachAmbient(): void {
    track.addEventListener("scroll", markDirty, { passive: true });
    window.addEventListener("scroll", markDirty, { passive: true });
    dirty = true;
  }

  function detachAmbient(): void {
    track.removeEventListener("scroll", markDirty);
    window.removeEventListener("scroll", markDirty);
  }

  function frameAmbient(): void {
    if (probe.version !== version) {
      version = probe.version;
      dirty = true;
    }
    if (!dirty || !visible) return;
    dirty = false;
    const box = track.getBoundingClientRect();
    rects.length = cards.length;
    for (let i = 0; i < cards.length; i += 1) rects[i] = cards[i].getBoundingClientRect();
    setFront(nearestCard(rects, box.left + box.width / 2, probe.headerH + layerHeight() / 2));
  }

  /* ---- modes ----------------------------------------------------------------------------- */

  /** Tear the current mode down; `next` replaces the card list between the restore and the scroll fix. */
  function leave(compensate: boolean, next?: HTMLElement[]): void {
    setFront(-1);
    clearLit();
    if (mode === "ambient") detachAmbient();
    const anchor = trackSaved && compensate ? anchorBefore() : null;
    if (trackSaved) restoreAll();
    if (next) cards = next;
    anchorAfter(anchor);
  }

  function apply(want: WorkHelixMode): void {
    if (want === mode) return;
    if (want === "spiral" && !isSafe()) return;
    leave(true);
    if (want === "spiral") enterSpiral();
    else if (want === "ambient") attachAmbient();
    version = probe.version;
    setMode(want);
  }

  function fail(): void {
    if (broken) return;
    broken = true;
    try {
      leave(true);
    } catch {
      try {
        restoreAll();
      } catch {
        // nothing left to try
      }
    }
    try {
      setMode("off");
    } catch {
      // the stage's callback threw too; the page is restored either way
    }
  }

  function guard(run: () => void): void {
    if (broken || disposed) return;
    try {
      run();
    } catch {
      fail();
    }
  }

  /* ---- listeners ------------------------------------------------------------------------- */

  const media = supported ? matchMedia!(WORK_HELIX_MEDIA) : null;
  const onMedia = () => guard(() => apply(wantedHelixMode(built, cards.length, media!.matches)));

  const onFocusIn = (event: FocusEvent) => {
    focusDirty = true;
    guard(() => {
      if (mode !== "spiral" || event.timeStamp - pointerAt < POINTER_FOCUS_MS) return;
      const target = event.target instanceof Node ? event.target : null;
      const i = target ? cards.findIndex((card) => card.contains(target)) : -1;
      if (i < 0) return;
      // No `behavior`: html's `scroll-behavior` decides, as for any in-page jump.
      window.scrollTo({ top: scrollForCard(i, cards.length, span) });
    });
  };
  const onFocusOut = () => {
    focusDirty = true;
  };
  const onPointerDown = (event: PointerEvent) => {
    pointerAt = event.timeStamp;
  };

  const onChildren = () =>
    guard(() => {
      const next = collectCards();
      if (next.length === cards.length && next.every((el, i) => el === cards[i])) return;
      if (mode === "spiral" && next.length >= HELIX_MIN_CARDS) {
        leave(false, next);
        enterSpiral();
      } else if (mode === "spiral") {
        leave(true, next);
        attachAmbient();
        setMode("ambient");
      } else {
        setFront(-1);
        cards = next;
        dirty = true;
      }
    });

  let io: IntersectionObserver | null = null;
  let mo: MutationObserver | null = null;
  if (supported) {
    media!.addEventListener?.("change", onMedia);
    io = new window.IntersectionObserver((entries) => {
      for (const entry of entries) {
        visible = entry.isIntersecting;
        if (visible) dirty = true;
      }
    });
    io.observe(section);
    if (typeof window.MutationObserver === "function") {
      mo = new window.MutationObserver(onChildren);
      mo.observe(track, { childList: true });
    }
    track.addEventListener("focusin", onFocusIn);
    track.addEventListener("focusout", onFocusOut);
    track.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
  }

  return {
    focus(scrollY) {
      return mode === "spiral" ? helixFocusAt(scrollY, span, cards.length, stepPx, exitLength) : 0;
    },
    exit(scrollY) {
      return mode === "spiral" ? helixExitAt(scrollY, span, exitLength) : 0;
    },
    write(s) {
      guard(() => {
        if (!track.isConnected) return;
        built = s.built;
        apply(wantedHelixMode(built, cards.length, media!.matches));
        if (mode === "spiral") frameSpiral(s.focus, s.enter ?? 1);
        else if (mode === "ambient") frameAmbient();
      });
    },
    front: () => front,
    cards: () => cards,
    mode: () => mode,
    dispose() {
      if (disposed) return;
      disposed = true;
      io?.disconnect();
      mo?.disconnect();
      if (media) media.removeEventListener?.("change", onMedia);
      track.removeEventListener("focusin", onFocusIn);
      track.removeEventListener("focusout", onFocusOut);
      track.removeEventListener("pointerdown", onPointerDown, { capture: true });
      if (broken) return;
      try {
        leave(true);
      } catch {
        try {
          restoreAll();
        } catch {
          // nothing left to try
        }
      }
      try {
        setMode("off");
      } catch {
        // restored either way
      }
    },
  };
}
