"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Modal } from "@/components/ui/Modal";
import { directionHref, directions } from "@/lib/directions";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { format } from "@/lib/i18n/format";
import { projectGradient } from "@/lib/projectAccent";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { useSiteContent, type ProjectItem } from "@/lib/siteContent";
import { directionTab, projectRequestType, projectsForSolution, solUI } from "@/lib/solutions";
import { REDUCED_MOTION_QUERY } from "@/lib/tilt";
import s from "./Portfolio.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const COPY = {
  title: L("Portofoliu", "Портфолио", "Portfolio"),
  count: L("Proiecte", "Проекты", "Projects"),
  stage: L("Proiectele noastre", "Наши проекты", "Our projects"),
  open: L("Deschide site-ul ↗", "Открыть сайт ↗", "Open the site ↗"),
  private: L("nu are pagină publică", "нет публичной страницы", "no public page"),
  /* the service filter */
  channels: L("Proiecte după serviciu", "Проекты по услугам", "Projects by service"),
  all: L("Toate", "Все", "All"),
  /* the screen and the pixels */
  prev: L("Proiectul anterior", "Предыдущий проект", "Previous project"),
  next: L("Proiectul următor", "Следующий проект", "Next project"),
  pick: L("Alege proiectul", "Выберите проект", "Choose a project"),
  zoom: L("Vezi mai mare", "Увеличить", "View larger"),
  /* the picture's name starts with the chip's own words, so a voice saying them finds it */
  zoomOf: L(
    "Vezi mai mare captura de ecran: {name}",
    "Увеличить снимок экрана: {name}",
    "View larger: the screenshot of {name}",
  ),
  shotOf: L("Captură de ecran: {name}", "Снимок экрана: {name}", "Screenshot: {name}"),
  more: L("Citește tot ↓", "Читать полностью ↓", "Read more ↓"),
  less: L("Mai puțin ↑", "Свернуть ↑", "Show less ↑"),
  /* said to a screen reader as the screen changes, and as a channel narrows the pixels */
  onScreen: L("{name}, proiectul {n} din {total}", "{name}, проект {n} из {total}", "{name}, project {n} of {total}"),
  filtered: L("{label}: {count}.", "{label}: {count}.", "{label}: {count}."),
  /* the project's request */
  similar: L("Vreau un proiect similar", "Хочу похожий проект", "I want a similar project"),
  /* the close, while a service is chosen */
  openService: L("Deschide serviciul", "Открыть услугу", "Open the service"),
};

/* "{n} proiecte" in the visitor's language — Romanian says "20 de proiecte", Russian has three forms. */
function projectCount(n: number, l: (v: LocalizedText) => string): string {
  const ru =
    n % 10 === 1 && n % 100 !== 11
      ? "проект"
      : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
        ? "проекта"
        : "проектов";
  const ro = n === 1 ? "1 proiect" : n % 100 >= 20 || n % 100 === 0 ? `${n} de proiecte` : `${n} proiecte`;
  return l(L(ro, `${n} ${ru}`, n === 1 ? "1 project" : `${n} projects`));
}

/* The filter's channels in plain words, for a visitor who never heard of an API or a UI. Only
   here: Home's pills, the menu and the service pages keep the official names (`directionTab`),
   and the close's "Deschide serviciul: …" link joins the two. */
const CHANNEL_LABEL: Record<string, LocalizedText> = {
  "produs-digital": L("Aplicații și platforme", "Приложения и платформы", "Apps & platforms"),
  "e-commerce": L("Magazine online", "Интернет-магазины", "Online shops"),
  "automatizare-api": L("Programe interne", "Внутренние системы", "Internal systems"),
  "asistenti-ia": L("Boturi și chat", "Боты и чаты", "Bots & chat"),
  "brand-ui": L("Site-uri și design", "Сайты и дизайн", "Sites & design"),
};

/** The pixel transition on the screen: a grid of this many blocks (columns × rows). */
const FX_COLS = 16;
const FX_ROWS = 10;
/** A swipe across the screen: this far sideways, and mostly sideways. */
const SWIPE_PX = 40;
/** The click a browser may send after a swipe arrives within this long of it. */
const SWIPE_CLICK_MS = 400;
/** The page's ease-out (`--motion-ease-out`), for the animations started from script. */
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

const pad = (n: number) => String(n).padStart(2, "0");

const reducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;

/** Whether `el`'s focus is one the browser shows — the keyboard's, not a tap's or a click's. */
function focusVisible(el: Element): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true; // an engine that cannot tell: treat it as the keyboard's
  }
}

/** A project colour (`lib/projectAccent.ts` keeps them as `#rrggbb`) as its three channels. */
function rgbOf(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  const value = match ? parseInt(match[1], 16) : 0x808080;
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * How brightly each of a pixel's three subpixels burns to make `hex`: its red, green and blue
 * shares, never quite off — a real pixel's dark subpixel still shows as a dim bar.
 */
function subpixels(hex: string): [number, number, number] {
  const level = (c: number) => Math.round((0.14 + 0.86 * (c / 255)) * 100) / 100;
  const [r, g, b] = rgbOf(hex);
  return [level(r), level(g), level(b)];
}

/** A project's two colours as `--p1` / `--p2`, and its pixel's subpixel levels as `--sr/--sg/--sb`. */
function accentStyle(project: ProjectItem, position: number): CSSProperties {
  const [p1, p2] = projectGradient(project, position);
  const [sr, sg, sb] = subpixels(p2);
  return { "--p1": p1, "--p2": p2, "--sr": sr, "--sg": sg, "--sb": sb } as CSSProperties;
}

/**
 * /portofoliu — one project at a time on a big screen, and under it one pixel per project with
 * its name under it: the pixels are the navigation (2026-10-05: of four prototypes, the owner
 * chose this one over the field of 3px points, which "nu este intuitiv").
 *
 *  · the SCREEN shows the current project's screenshot; ‹ › beside it (on it, on a phone), ← →
 *    from the keyboard, a swipe on a phone. Switching plays a short pixel transition: the old
 *    picture breaks into blocks of the new project's colours and the new one comes through.
 *    Pressing the picture shows it larger;
 *  · the PIXELS: one labelled button per project, in its colour; the current one is lit and
 *    opened into its red, green and blue subpixels — "one pixel = one project", made literal;
 *  · beside the screen, the project's words: "01 / 09", its name, its tag, its description (a
 *    long one folds, "Citește tot"), "Vreau un proiect similar" (the request dialog, with the
 *    project attached) and its site;
 *  · the SERVICE FILTER narrows the pixels and the count, in plain words;
 *  · the CLOSE after the section: the service pages' closing panel.
 * The first project is on the screen from the server on, so nothing waits for the script.
 */
export function Portfolio() {
  const { projects } = useSiteContent();
  const l = useLoc();
  const { openRequest } = useRequestFlow();
  const screenRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const shotBtnRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const askRef = useRef<HTMLButtonElement>(null);
  const ghostsRef = useRef<HTMLDivElement>(null);
  const pixelRefs = useRef(new Map<string, HTMLButtonElement>());
  /* The pixel transition in flight: its run number, and how it learns the new picture is ready. */
  const fxRun = useRef(0);
  const fxReveal = useRef<(() => void) | null>(null);
  /* The project's words rise in when another project comes on (not on the first paint). */
  const riseInfo = useRef(false);
  /* The control of the stage that had the focus as the project changed, where it was, and whether
     the keyboard had put it there. When the change takes it away — a site link the next project
     has not, a "Citește tot" it does not need, the picture of a project without one — the focus
     goes on (to the red button, or to the project's pixel) rather than to the top of the page. */
  const keepFocus = useRef<{ el: HTMLElement; inInfo: boolean; keyboard: boolean } | null>(null);
  /* Where each pixel stood before a channel was pressed, to glide them to their new places. */
  const flipFrom = useRef<Map<string, DOMRect> | null>(null);
  /* A sideways swipe on the screen, and when it ended: the click it may turn into is dropped. */
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const swipedAt = useRef(-Infinity);
  const [channel, setChannel] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  /* Every direction with at least one live project, in the menu's order, with its projects in the
     curated order — the first is the direction's reference project. A direction with none gets
     no channel (e-commerce, today). */
  const channels = useMemo(
    () =>
      directions
        .map((d) => ({ slug: d.slug, members: projectsForSolution(d.slug, projects) }))
        .filter((c) => c.members.length > 0),
    [projects],
  );
  /* A channel whose projects all left (new content arrived) falls back to all of them. */
  const tuned = channels.find((c) => c.slug === channel) ?? null;
  /* A channel's projects in the page's own order, so the pixels never reshuffle. */
  const listFor = (slug: string | null) => {
    const members = channels.find((c) => c.slug === slug)?.members;
    return members ? projects.filter((p) => members.includes(p)) : projects;
  };
  const list = listFor(tuned?.slug ?? null);
  const current = list.find((p) => p.id === selectedId) ?? list[0] ?? null;
  const pos = current ? list.indexOf(current) : -1;
  /* The description as it reads now: a change of language changes it with the project unchanged. */
  const descText = current ? l(current.desc) : "";

  /* Another project is on: the transition's blocks go out once its picture has decoded, and its
     words rise in. */
  useLayoutEffect(() => {
    const reveal = fxReveal.current;
    const img = imgRef.current;
    if (reveal) {
      if (img && typeof img.decode === "function") img.decode().then(reveal, reveal);
      else reveal();
    }
    const info = infoRef.current;
    if (!riseInfo.current) return;
    riseInfo.current = false;
    if (!info || typeof info.animate !== "function" || reducedMotion()) return;
    info.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], {
      duration: 260,
      easing: EASE_OUT,
    });
  }, [current]);

  /* A long description folds to its first lines; "Citește tot" shows only when something is
     folded away — measured again for another project, another language, another width, and once
     the web font is in. Written straight on the button: it is a measurement, not state. Then the
     focus the change took away goes on: from the words to the red button, from the picture to the
     project's pixel; without scrolling the page when it was not the keyboard's (a tap leaves the
     focus on a phone's button). */
  useLayoutEffect(() => {
    const desc = descRef.current;
    const more = moreRef.current;
    if (!desc || !more) return;
    const check = () => {
      more.hidden = !expanded && desc.scrollHeight <= desc.clientHeight + 2;
    };
    check();
    const had = keepFocus.current;
    keepFocus.current = null;
    if (had && (!had.el.isConnected || had.el.hidden)) {
      const to = had.inInfo ? askRef.current : current ? pixelRefs.current.get(current.id) : null;
      to?.focus({ preventScroll: !had.keyboard });
    }
    let live = true;
    /* the web font can still change where the lines break */
    document.fonts?.ready.then(() => {
      if (live) check();
    });
    if (typeof ResizeObserver !== "function") {
      return () => {
        live = false;
      };
    }
    const observer = new ResizeObserver(check);
    observer.observe(desc);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [current, expanded, descText]);

  /* A pressed channel: the pixels that stay glide from where they stood to their new places; the
     ones that come back switch on (their CSS); the ones that leave fade as copies (chooseChannel). */
  useLayoutEffect(() => {
    const from = flipFrom.current;
    flipFrom.current = null;
    if (!from || reducedMotion()) return;
    pixelRefs.current.forEach((el, id) => {
      const before = from.get(id);
      if (!before || typeof el.animate !== "function") return;
      const after = el.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration: 280,
        easing: EASE_OUT,
      });
    });
  }, [channel]);

  /* The other screenshots, warmed up once the page is idle, so every switch is instant. */
  useEffect(() => {
    const warm = () =>
      projects.forEach((p) => {
        const src = p.images?.[0];
        if (!src) return;
        const img = new Image();
        img.decoding = "async";
        img.src = src;
      });
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(warm, 600);
    return () => window.clearTimeout(timer);
  }, [projects]);

  /* The pixel transition (~350ms): the picture on the screen now is painted on the canvas over
     it, the <img> changes underneath, and the canvas breaks into blocks of the new project's
     colours — then, once the new picture has decoded, the blocks go out, from the side the new
     one comes in. Nothing of it under reduced motion, or with no picture to break up. */
  const breakScreen = (to: ProjectItem, dir: number) => {
    const img = imgRef.current;
    const canvas = fxRef.current;
    const screen = screenRef.current;
    const ctx = canvas?.getContext("2d");
    fxReveal.current = null;
    const run = ++fxRun.current;
    if (!img || !canvas || !screen || !ctx || reducedMotion() || !img.complete || img.naturalWidth === 0) {
      canvas?.removeAttribute("data-on");
      return;
    }
    const box = screen.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(1, Math.round(box.width * dpr));
    const H = Math.max(1, Math.round(box.height * dpr));
    canvas.width = W;
    canvas.height = H;
    /* the picture as the <img> shows it: covering the screen, from its top */
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    try {
      ctx.drawImage(img, (W - img.naturalWidth * scale) / 2, 0, img.naturalWidth * scale, img.naturalHeight * scale);
    } catch {
      canvas.removeAttribute("data-on");
      return;
    }
    canvas.setAttribute("data-on", "");

    /* Each block: when it breaks, when it goes, and its shade — the new project's two colours,
       mixed, laid at some strength over the black matrix (the page's --void). */
    const n = FX_COLS * FX_ROWS;
    const breakAt = new Float32Array(n);
    const goAt = new Float32Array(n);
    const shade: string[] = [];
    const strength = new Float32Array(n);
    const [p1, p2] = projectGradient(to, projects.indexOf(to));
    const c1 = rgbOf(p1);
    const c2 = rgbOf(p2);
    const matrix = getComputedStyle(canvas).getPropertyValue("--void").trim() || "black";
    for (let k = 0; k < n; k++) {
      const c = k % FX_COLS;
      const sweep = dir > 0 ? (FX_COLS - 1 - c) / (FX_COLS - 1) : c / (FX_COLS - 1);
      breakAt[k] = sweep * 100 + Math.random() * 60; // 0–160ms: the old picture breaks up
      goAt[k] = sweep * 90 + Math.random() * 90; // 0–180ms after the reveal: the blocks go out
      const t = 0.3 + Math.random() * 0.7;
      shade.push(`rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(",")})`);
      strength[k] = 0.55 + Math.random() * 0.45;
    }
    const t0 = performance.now();
    let revealAt = Infinity;
    const reveal = () => {
      if (run === fxRun.current && revealAt === Infinity) revealAt = Math.max(performance.now() - t0, 170);
    };
    fxReveal.current = reveal;
    window.setTimeout(reveal, 1500); // a slow picture never holds the blocks longer than this

    const state = new Uint8Array(n); // 0 whole, 1 broken into its block, 2 gone
    const bw = W / FX_COLS;
    const bh = H / FX_ROWS;
    const gap = Math.max(1, Math.round(dpr));
    const frame = (now: number) => {
      if (run !== fxRun.current) return;
      const t = now - t0;
      let alive = 0;
      for (let k = 0; k < n; k++) {
        if (state[k] === 2) continue;
        const c = k % FX_COLS;
        const r = (k / FX_COLS) | 0;
        const x = Math.round(c * bw);
        const y = Math.round(r * bh);
        const w = Math.round((c + 1) * bw) - x;
        const h = Math.round((r + 1) * bh) - y;
        if (state[k] === 0 && t >= breakAt[k]) {
          ctx.fillStyle = matrix;
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = strength[k];
          ctx.fillStyle = shade[k];
          ctx.fillRect(x + gap, y + gap, w - gap, h - gap);
          ctx.globalAlpha = 1;
          state[k] = 1;
        }
        if (state[k] === 1 && t >= revealAt + goAt[k]) {
          ctx.clearRect(x, y, w, h);
          state[k] = 2;
          continue;
        }
        alive++;
      }
      if (alive) window.requestAnimationFrame(frame);
      else canvas.removeAttribute("data-on");
    };
    window.requestAnimationFrame(frame);
  };

  /* Put `to` on the screen, coming in from the right (dir 1) or the left (-1). */
  const goTo = (to: ProjectItem, dir: number, inList = list) => {
    if (current && to.id === current.id) return;
    const active = document.activeElement;
    keepFocus.current =
      active instanceof HTMLElement && stageRef.current?.contains(active)
        ? { el: active, inInfo: !!infoRef.current?.contains(active), keyboard: focusVisible(active) }
        : null;
    breakScreen(to, dir);
    riseInfo.current = true;
    setSelectedId(to.id);
    setExpanded(false);
    setZoomOpen(false);
    setAnnouncement(format(l(COPY.onScreen), { name: to.name, n: inList.indexOf(to) + 1, total: inList.length }));
  };
  /* The neighbour `d` steps from `from` — the project on the screen, or the pixel with the focus —
     round the list. From the screen's project the new one comes in from the side it was asked
     from; from another pixel, from the side it stands on. */
  const step = (d: number, from: ProjectItem | null = current) => {
    if (!from || list.length < 2) return null;
    const to = list[(list.indexOf(from) + d + list.length) % list.length];
    goTo(to, from === current ? d : list.indexOf(to) >= pos ? 1 : -1);
    return to;
  };

  /* A channel narrows the pixels to its projects. The project on the screen stays if it is one of
     them; otherwise the channel's first project comes on. The pixels that leave fade where they
     stood, as copies in `.ghosts`, while the row closes up. */
  const chooseChannel = (slug: string | null) => {
    if (slug === (tuned?.slug ?? null)) return;
    const next = listFor(slug);
    const stays = new Set(next.map((p) => p.id));
    const ghosts = ghostsRef.current;
    const origin = ghosts?.getBoundingClientRect();
    const fade = !reducedMotion();
    const rects = new Map<string, DOMRect>();
    pixelRefs.current.forEach((el, id) => {
      const box = el.getBoundingClientRect();
      rects.set(id, box);
      if (stays.has(id) || !fade || !ghosts || !origin || typeof el.animate !== "function") return;
      const ghost = el.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("data-project");
      ghost.style.left = `${box.left - origin.left}px`;
      ghost.style.top = `${box.top - origin.top}px`;
      ghost.style.width = `${box.width}px`;
      ghosts.append(ghost);
      ghost.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.6)" }], {
        duration: 180,
        easing: "ease-in",
        fill: "forwards",
      }).onfinish = () => ghost.remove();
    });
    flipFrom.current = rects;
    setChannel(slug);
    const label = slug ? l(CHANNEL_LABEL[slug] ?? directionTab[slug]) : l(COPY.all);
    const said = format(l(COPY.filtered), { label, count: projectCount(next.length, l) });
    if (current && !next.includes(current) && next[0]) {
      goTo(next[0], 1, next);
      setAnnouncement(`${said} ${format(l(COPY.onScreen), { name: next[0].name, n: 1, total: next.length })}`);
    } else {
      setAnnouncement(said);
    }
  };

  /* ← → anywhere on the stage. A pixel with the focus hands it on to its neighbour, so the keys
     walk the row. */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    if (event.repeat) return;
    const d = event.key === "ArrowRight" ? 1 : -1;
    const focusedId = event.target instanceof HTMLElement ? event.target.dataset.project : undefined;
    const fromPixel = list.find((p) => p.id === focusedId) ?? null;
    const to = step(d, fromPixel ?? current);
    if (fromPixel && to) pixelRefs.current.get(to.id)?.focus();
  };

  /* A sideways swipe on the screen: a finger's or a pen's, never the mouse's. */
  const onScreenDown = (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse") return;
    swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onScreenUp = (event: ReactPointerEvent) => {
    const start = swipe.current;
    if (!start || start.id !== event.pointerId) return;
    swipe.current = null;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    swipedAt.current = event.timeStamp;
    step(dx < 0 ? 1 : -1);
  };
  const onShotClick = (event: ReactMouseEvent) => {
    if (event.timeStamp - swipedAt.current < SWIPE_CLICK_MS) return; // the swipe's own click
    setZoomOpen(true);
  };

  /* "Vreau un proiect similar": the request dialog, carrying the project and — when the visitor
     chose one — the service. */
  const ask = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!current) return;
    openRequest({
      source: "project-card",
      projectId: current.id,
      projectName: current.name,
      projectType: projectRequestType[current.id],
      serviceSlug: tuned?.slug,
      returnFocusTo: event.currentTarget,
    });
  };

  const image = current?.images?.[0];
  const stores = current
    ? [
        { href: current.appStore, label: "App Store ↗" },
        { href: current.playStore, label: "Google Play ↗" },
      ].filter((store) => store.href)
    : [];

  return (
    <>
      <section id="portofoliu" className={s.page}>
        <div className="container">
          {/* A <div>, not a <header>: the scroll rail skips every heading inside a header, and the
              h1 is what names this section's marker. */}
          <div className={s.head}>
            <h1 className={s.title}>{l(COPY.title)}</h1>
            {/* The count lives on in the first channel: "Toate · 9". With no service to filter
                by (no project in any of them), the plain count. */}
            {channels.length > 0 ? (
              <div role="group" aria-label={l(COPY.channels)} className={s.channels}>
                <button
                  type="button"
                  aria-pressed={tuned === null}
                  className={`mono ${s.channel}`}
                  onClick={() => chooseChannel(null)}
                >
                  {l(COPY.all)} · <b>{projects.length}</b>
                </button>
                {channels.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    aria-pressed={tuned?.slug === c.slug}
                    className={`mono ${s.channel}`}
                    onClick={() => chooseChannel(c.slug)}
                  >
                    {l(CHANNEL_LABEL[c.slug] ?? directionTab[c.slug])} · <b>{c.members.length}</b>
                  </button>
                ))}
              </div>
            ) : (
              <p className={`mono ${s.count}`}>
                {l(COPY.count)} · <b>{projects.length}</b>
              </p>
            )}
          </div>

          {current ? (
            <div
              ref={stageRef}
              role="region"
              aria-label={l(COPY.stage)}
              className={s.stage}
              style={accentStyle(current, projects.indexOf(current))}
              onKeyDown={onKeyDown}
            >
              <div className={s.left}>
                <div className={s.viewer}>
                  <button
                    type="button"
                    className={`${s.nav} ${s.navPrev}`}
                    aria-label={l(COPY.prev)}
                    disabled={list.length < 2}
                    onClick={() => step(-1)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M14.5 5.5 8 12l6.5 6.5" />
                    </svg>
                  </button>
                  {/* The monitor: a thin bezel, a chin with the brand's three subpixels, a glow in
                      the current project's colour. */}
                  <div className={s.monitor}>
                    <div
                      ref={screenRef}
                      className={s.screen}
                      onPointerDown={onScreenDown}
                      onPointerUp={onScreenUp}
                      onPointerCancel={() => {
                        swipe.current = null;
                      }}
                    >
                      {image ? (
                        <button
                          ref={shotBtnRef}
                          type="button"
                          className={s.shotBtn}
                          aria-label={format(l(COPY.zoomOf), { name: current.name })}
                          onClick={onShotClick}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img ref={imgRef} src={image} alt="" decoding="async" fetchPriority="high" className={s.shot} />
                        </button>
                      ) : (
                        <span className={s.blank} aria-hidden="true">
                          {current.name}
                        </span>
                      )}
                      <canvas ref={fxRef} className={s.fx} aria-hidden="true" />
                      {image ? (
                        <span className={s.zoomChip} aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                          </svg>
                          {l(COPY.zoom)}
                        </span>
                      ) : null}
                      <span className={s.screenRing} aria-hidden="true" />
                    </div>
                    <span className={s.rgb} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`${s.nav} ${s.navNext}`}
                    aria-label={l(COPY.next)}
                    disabled={list.length < 2}
                    onClick={() => step(1)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9.5 5.5 16 12l-6.5 6.5" />
                    </svg>
                  </button>
                </div>

                {/* The pixels: one labelled button per project. At rest a flat square of its
                    colour; the current one is seen up close — opened into its red, green and blue
                    subpixels, each lit to its share of the colour. */}
                <div className={s.pixels} role="group" aria-label={l(COPY.pick)}>
                  {list.map((p, k) => (
                    <button
                      key={p.id}
                      ref={(el) => {
                        if (el) pixelRefs.current.set(p.id, el);
                        else pixelRefs.current.delete(p.id);
                      }}
                      type="button"
                      data-project={p.id}
                      aria-current={p.id === current.id ? "true" : undefined}
                      className={s.px}
                      style={{ ...accentStyle(p, projects.indexOf(p)), "--k": k } as CSSProperties}
                      onClick={() => goTo(p, k >= pos ? 1 : -1)}
                    >
                      <span className={s.pxDot} aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className={`mono ${s.pxName}`}>{p.name}</span>
                    </button>
                  ))}
                  <div ref={ghostsRef} className={s.ghosts} aria-hidden="true" inert />
                </div>
              </div>

              {/* The project's words. */}
              <div ref={infoRef} className={s.info}>
                <p className={`mono ${s.counter}`}>
                  <span>
                    <b>{pad(pos + 1)}</b> / {pad(list.length)}
                  </span>
                </p>
                <h2 className={s.name}>{current.name}</h2>
                <p className={`mono ${s.tag}`}>
                  <span className={s.tagPx} aria-hidden="true" />
                  <span>{l(current.tag)}</span>
                </p>
                <p ref={descRef} id="portofoliu-descriere" className={`${s.desc} ${expanded ? "" : s.folded}`}>
                  {l(current.desc)}
                </p>
                {/* Hidden from the server on, and shown by the measurement above when something is
                    folded away. Hidden, it keeps its row (the CSS), so neither the page waking nor
                    a change of project moves the buttons under it. React never writes `hidden`
                    again (the prop never changes). */}
                <button
                  ref={moreRef}
                  type="button"
                  hidden
                  className={s.more}
                  aria-expanded={expanded}
                  aria-controls="portofoliu-descriere"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {l(expanded ? COPY.less : COPY.more)}
                </button>
                <div className={s.actions}>
                  <button ref={askRef} type="button" className={s.ask} onClick={ask}>
                    {l(COPY.similar)}
                  </button>
                  {/* In the same tab: a new tab greys out Back, and a visitor who closes it to
                      return closes the whole window, this page with it. */}
                  <span className={s.links}>
                    {current.url ? (
                      <a href={current.url} className={s.link}>
                        {l(COPY.open)}
                      </a>
                    ) : (
                      <span className={s.private}>{l(COPY.private)}</span>
                    )}
                    {stores.map((store) => (
                      <a key={store.label} href={store.href} className={s.link}>
                        {store.label}
                      </a>
                    ))}
                  </span>
                </div>
              </div>
              <p className={s.srOnly} aria-live="polite">
                {announcement}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* The screenshot, larger, in the site's dialog. Open only while there is a picture: new
          content that takes it away closes the dialog instead of unmounting it open. */}
      {current ? (
        <Modal
          open={zoomOpen && Boolean(image)}
          onClose={() => setZoomOpen(false)}
          title={current.name}
          ground="ink"
          className={s.zoomPanel}
          restoreFocusRef={shotBtnRef}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={format(l(COPY.shotOf), { name: current.name })} className={s.zoomImg} />
          ) : null}
        </Modal>
      ) : null}

      {/* The close: the service pages' closing panel, with their own approved words. Its own
          section, with its own heading — the scroll rail gives it a second marker. */}
      <section className={s.close}>
        <div className="container">
          <div className={s.closePanel}>
            <span className={s.closeFrame} aria-hidden="true">
              <span className={s.closeThread} />
            </span>
            <h2 className={`disp ${s.closeTitle}`}>{l(solUI.bottomTitle)}</h2>
            <div className={s.closeActions}>
              <button
                type="button"
                className={s.cta}
                onClick={(event) =>
                  openRequest({ source: "portfolio-bottom", serviceSlug: tuned?.slug, returnFocusTo: event.currentTarget })
                }
              >
                {l(solUI.start)}
              </button>
              {tuned ? (
                <Link href={directionHref(tuned.slug)} className={s.serviceLink}>
                  {l(COPY.openService)}: {l(directionTab[tuned.slug])} <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
