import {
  buildBoard,
  CLIP,
  HEAD,
  pathOf,
  planPulse,
  PULSE,
  squaresOf,
  TAIL,
  VIA,
  type Board,
  type BoardChin,
  type BoardPad,
  type BoardRoute,
} from "@/lib/portfolioBoard";

const SVGNS = "http://www.w3.org/2000/svg";

const px = (v: number) => String(Math.round(v * 100) / 100);

/** The CSS module's names for the board's pieces (Portfolio.module.css). */
export interface CircuitClasses {
  /** a pixel's pad place (its middle is where the pad's trace starts) */
  dot: string;
  /** a pixel's name, under its pad: on a row of several lines the web keeps its lines clear of it */
  name: string;
  tracks: string;
  vias: string;
  litHalo: string;
  litLine: string;
  litVia: string;
  litViaHalo: string;
  runHalo: string;
  runLine: string;
  headHalo: string;
  headBody: string;
  headCore: string;
  viaSpark: string;
}

export interface CircuitParts {
  /** The row of pixels (`data-project` buttons): the board's px are its padding box. */
  row: HTMLElement;
  /** The board, laid over the row (left 0, top 0, the row's size, nothing clipped). */
  svg: SVGSVGElement;
  /** The chin's flash, in the row, centred on the point it is placed at. */
  flash: HTMLElement;
  monitor: HTMLElement;
  /** The chin's RGB glyph: the trunk ends at its foot. */
  glyph: HTMLElement;
  classes: CircuitClasses;
  /** Whether the visitor asked for less motion (asked at every switch). */
  reduced: () => boolean;
}

export interface Circuit {
  /** The board drawn for the layout as it is now (redrawn only when it moved), the route of `id`
   *  lit and still. */
  place(id: string | null): void;
  /** Another project took over in the row as it is: the old route goes dark, a pulse leaves the
   *  new pad and runs its route into the chin, which flashes. Returns when the pulse gets there:
   *  `ms` from now, and `at`, the moment itself (performance.now() time) once its animations have
   *  started — on the next frame, later when that frame is a heavy one. Null when no pulse runs
   *  (reduced motion, a row wired to nothing). */
  play(id: string): { ms: number; at: Promise<number> } | null;
  /** The row glides (a channel) or slides (a page): the board waits unseen until `moving` ends,
   *  then is drawn still where the pads stopped, the route of `id` lit. */
  wait(id: string | null, moving: readonly Animation[]): void;
  dispose(): void;
}

/** Every switch's clip windows need ids unique in the page. */
let clipSeq = 0;

/**
 * The circuit board under /portofoliu's screen, drawn and played (lib/portfolioBoard.ts routes
 * it). Measured from the layout, in the row's own px: every pad's middle, and the monitor's chin.
 * Redrawn only when that moved (the row or the monitor changed size, another page, another
 * channel, the fonts); the route of the project on the screen is drawn lit over it.
 *
 * The switch (`play`): no stroke-dashoffset — each straight run of the route is a window (a static
 * clip) in which one group slides along it (translateX, WAAPI): the light that fills the run
 * behind the head, and the head. Whatever is in flight lands at once — a new pick, a resize — in
 * its end state: the new route lit and still, the chin quiet.
 */
export function createCircuit({ row, svg, flash, monitor, glyph, classes: c, reduced }: CircuitParts): Circuit {
  /** the layout the board was drawn for, and what it drew */
  let key = "";
  let board: Board | null = null;
  /** the project whose route is asked to be lit */
  let lit: string | null = null;
  /** the route drawn lit (or running), and whose */
  let litGroup: SVGGElement | null = null;
  let litShown: string | null = null;
  /** the switch in flight: its animations, and the pieces it added */
  let fx: { anims: Animation[]; trash: Element[] } | null = null;
  /** the wait for a glide in progress (its number), 0 when there is none */
  let waiting = 0;
  let waits = 0;
  let live = true;

  const node = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [name, value] of Object.entries(attrs)) n.setAttribute(name, value);
    return n;
  };
  const path = (cls: string, d: string) => node("path", { class: cls, d });

  const pixelOf = (id: string) =>
    Array.from(row.children).find(
      (el): el is HTMLElement => el instanceof HTMLElement && el.dataset.project === id,
    ) ?? null;
  /** A pixel's two colours onto a piece of the board, which would otherwise take the stage's (the
   *  project on the screen now): an old route going dark keeps its own. */
  const colours = (id: string, to: SVGElement | HTMLElement) => {
    const from = pixelOf(id);
    for (const name of ["--p1", "--p2"]) {
      const value = from?.style.getPropertyValue(name).trim();
      if (value) to.style.setProperty(name, value);
    }
  };

  /* ---------- measuring ----------
     Box against box, scaled back to the row's own px: whatever moves or scales the page as a
     whole moves both. Never while a glide runs (the board waits for it). */
  function measure() {
    const width = row.clientWidth;
    if (!(width > 0)) return null;
    const box = row.getBoundingClientRect();
    /* offsetWidth is rounded to a whole px: a box within a px of it is not scaled */
    const k = row.offsetWidth > 0 && Math.abs(box.width - row.offsetWidth) > 1 ? box.width / row.offsetWidth : 1;
    const x0 = box.left + row.clientLeft * k;
    const y0 = box.top + row.clientTop * k;
    const X = (v: number) => (v - x0) / k;
    const Y = (v: number) => (v - y0) / k;
    const pads: BoardPad[] = [];
    const range = document.createRange();
    for (const el of Array.from(row.children)) {
      const id = el instanceof HTMLElement ? el.dataset.project : undefined;
      const dot = id ? el.getElementsByClassName(c.dot)[0] : undefined;
      if (!id || !dot) continue;
      const d = dot.getBoundingClientRect();
      if (!(d.width > 0)) continue;
      /* its name's text as laid out (a two-line name is two line boxes), not the name's box, which
         is as wide as the button: the web runs its spokes down the real gaps between names */
      const name = el.getElementsByClassName(c.name)[0];
      let label: BoardPad["label"];
      if (name) {
        range.selectNodeContents(name);
        const lines = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
        if (lines.length) {
          label = {
            left: X(Math.min(...lines.map((r) => r.left))),
            right: X(Math.max(...lines.map((r) => r.right))),
            bottom: Y(Math.max(...lines.map((r) => r.bottom))),
          };
        }
      }
      /* and half its place: the lit pad, which the web keeps clear of (32px; 26px on a phone) */
      pads.push({ id, x: X(d.left + d.width / 2), cy: Y(d.top + d.height / 2), half: d.width / k / 2, label });
    }
    const m = monitor.getBoundingClientRect();
    const g = glyph.getBoundingClientRect();
    const chin: BoardChin | null =
      m.width > 0 && g.width > 0 && g.height > 0
        ? { x: X(g.left + g.width / 2), foot: Y(g.bottom), mid: Y(g.top + g.height / 2), bottom: Y(m.bottom) }
        : null;
    const half = (v: number) => Math.round(v * 2);
    const at = JSON.stringify([
      Math.round(width),
      chin ? [half(chin.x), half(chin.foot), half(chin.mid), half(chin.bottom)] : 0,
      // a name's width too: the fonts arriving move no pad, but they move the gaps the web runs in
      pads.map((p) => [
        p.id,
        half(p.x),
        half(p.cy),
        half(p.half ?? 0),
        p.label ? [half(p.label.left), half(p.label.right), half(p.label.bottom)] : 0,
      ]),
    ]);
    return { width, pads, chin, key: at };
  }

  /* ---------- drawing ---------- */
  function clear() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    litGroup = null;
    litShown = null;
  }
  /** The board at rest for the layout just measured (the lit route is drawn over it). */
  function draw(m: NonNullable<ReturnType<typeof measure>>) {
    board = buildBoard(m.width, m.pads, m.chin);
    clear();
    const d = pathOf(board.tracks);
    if (d) svg.append(path(c.tracks, d));
    const v = squaresOf(board.vias, VIA);
    if (v) svg.append(path(c.vias, v));
    key = m.key;
    if (board.flash) {
      flash.style.left = `${px(board.flash[0])}px`;
      flash.style.top = `${px(board.flash[1])}px`;
    }
  }
  /** A route lit, still: its legs (mitred, one path) and its via. */
  function litOf(id: string, r: BoardRoute) {
    const g = node("g");
    colours(id, g);
    const d = pathOf(r.legs.map((l) => l.pts));
    if (d) g.append(path(c.litHalo, d), path(c.litLine, d));
    if (r.vias.length) g.append(path(c.litViaHalo, squaresOf(r.vias, VIA + 6)), path(c.litVia, squaresOf(r.vias, VIA)));
    return g;
  }
  function setLit(id: string | null) {
    litGroup?.remove();
    litGroup = null;
    litShown = id;
    const r = id && board ? board.routes.get(id) : undefined;
    if (!id || !r || !r.legs.length) return;
    litGroup = litOf(id, r);
    svg.append(litGroup);
  }
  /** Whatever is in flight lands now, in its end state: its animations stop, its pieces go, the
   *  route it was lighting is lit and still. */
  function land() {
    const run = fx;
    if (!run) return;
    fx = null;
    for (const a of run.anims) a.cancel();
    for (const n of run.trash) n.remove();
    setLit(litShown);
  }

  /* ---------- the switch ---------- */
  /** A lower line's via taking the light: it comes on, with a square spark. */
  function spark(g: SVGGElement, r: BoardRoute, at: number, run: NonNullable<typeof fx>) {
    const on = node("g");
    on.append(path(c.litViaHalo, squaresOf(r.vias, VIA + 6)), path(c.litVia, squaresOf(r.vias, VIA)));
    g.append(on);
    run.anims.push(on.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 60, delay: Math.max(0, at - 20), fill: "both" }));
    const flare = path(c.viaSpark, squaresOf(r.vias, 13));
    g.append(flare);
    run.anims.push(
      flare.animate(
        [
          { opacity: 0, transform: "scale(0.4)" },
          { opacity: 1, transform: "scale(1)", offset: 0.3 },
          { opacity: 0, transform: "scale(1.6)" },
        ],
        { duration: 240, delay: Math.max(0, at - 30), easing: "ease-out", fill: "both" },
      ),
    );
  }
  /** The pulse along every leg of the route, the via's spark between them, the chin's flash. */
  function pulse(id: string, r: BoardRoute, run: NonNullable<typeof fx>): number {
    const plan = planPulse(r);
    const g = node("g");
    colours(id, g);
    const defs = node("defs");
    g.append(defs);
    svg.append(g);
    run.trash.push(g);
    for (const part of plan.runs) {
      const clipId = `pf-run-${++clipSeq}`;
      const clip = node("clipPath", { id: clipId, clipPathUnits: "userSpaceOnUse" });
      clip.append(node("rect", { x: "0", y: px(-CLIP), width: px(part.length), height: px(2 * CLIP) }));
      defs.append(clip);
      const frame = node("g", {
        transform: `translate(${px(part.from[0])} ${px(part.from[1])}) rotate(${px(part.angle)})`,
      });
      const win = node("g", { "clip-path": `url(#${clipId})` });
      const slider = node("g");
      const fill = `M${px(-(part.length + TAIL + 2))} 0H0`;
      slider.append(
        path(c.runHalo, fill),
        path(c.runLine, fill),
        path(c.headHalo, `M${-HEAD.halo} 0H0`),
        path(c.headBody, `M${-HEAD.body} 0H0`),
        path(c.headCore, `M${-HEAD.core} 0H0`),
      );
      win.append(slider);
      frame.append(win);
      g.append(frame);
      run.anims.push(
        slider.animate(
          part.frames.map((f) => ({ offset: f.offset, transform: `translateX(${px(f.x)}px)` })),
          { duration: part.duration, delay: part.delay, fill: "both" },
        ),
      );
    }
    for (const at of plan.sparks) spark(g, r, at, run);
    if (board?.flash) {
      colours(id, flash);
      run.anims.push(
        flash.animate(
          [
            { opacity: 0, transform: "scale(0.55, 0.7)" },
            { opacity: 1, transform: "none", offset: 0.24 },
            { opacity: 0, transform: "scale(1.2, 1.05)" },
          ],
          { duration: PULSE.flash, delay: Math.max(0, plan.arrive - PULSE.flashLead), easing: "ease-out", fill: "both" },
        ),
      );
    }
    return plan.arrive;
  }

  function place(id: string | null) {
    lit = id;
    if (!live || waiting) return;
    const m = measure();
    if (!m) {
      land();
      clear();
      key = "";
      board = null;
      litShown = id;
      return;
    }
    const fresh = m.key !== key;
    if (fresh) {
      land();
      draw(m);
    }
    if (fresh || litShown !== id) {
      land();
      setLit(id);
    }
    svg.removeAttribute("data-wait");
  }

  function play(id: string): ReturnType<Circuit["play"]> {
    lit = id;
    if (!live || waiting) return null;
    const m = measure();
    if (!m || reduced() || typeof svg.animate !== "function") {
      place(id);
      return null;
    }
    if (m.key !== key) {
      land();
      draw(m);
    }
    svg.removeAttribute("data-wait");
    /* the old route goes dark: at once when a switch was still running, else in a blink */
    const busy = fx !== null;
    land();
    const old = litGroup;
    litGroup = null;
    litShown = id;
    const run: NonNullable<typeof fx> = { anims: [], trash: [] };
    fx = run;
    if (old) {
      if (busy) old.remove();
      else {
        run.trash.push(old);
        run.anims.push(old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: PULSE.fade, easing: "ease-out", fill: "forwards" }));
      }
    }
    const r = board?.routes.get(id);
    const arrive = r && r.legs.length ? pulse(id, r, run) : 0;
    if (!run.anims.length) {
      fx = null;
      setLit(id);
      return null;
    }
    /* cleaned up when the last piece ends */
    const done = () => {
      if (fx === run) land();
    };
    Promise.all(run.anims.map((a) => a.finished)).then(done, done);
    if (!(arrive > 0)) return null;
    /* every piece of the switch starts on the same frame, and the arrival counts from it */
    const at = run.anims[run.anims.length - 1].ready.then(
      (a) => (typeof a.startTime === "number" ? a.startTime : performance.now()) + arrive,
      () => NaN,
    );
    return { ms: arrive, at };
  }

  function wait(id: string | null, moving: readonly Animation[]) {
    lit = id;
    if (!live) return;
    land();
    const token = ++waits;
    waiting = token;
    svg.setAttribute("data-wait", "");
    Promise.all(moving.map((a) => a.finished.catch(() => null))).then(() => {
      if (waiting !== token || !live) return;
      waiting = 0;
      place(lit);
    });
  }

  /* Measured again whenever the row or the monitor changes size, and once the fonts are in. */
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => place(lit)) : null;
  observer?.observe(row);
  observer?.observe(monitor);
  document.fonts?.ready.then(() => place(lit));

  return {
    place,
    play,
    wait,
    dispose() {
      live = false;
      waiting = 0;
      observer?.disconnect();
      land();
      clear();
      key = "";
      board = null;
    },
  };
}
