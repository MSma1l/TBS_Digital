import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";

/*
 * The hero inside the interior stage (components/sections/Hero.tsx): the CTA boost signal to
 * the scene, the stat cards' tilt and holograms, and the hosts the stage and the director
 * rely on — where the core sits in the tree, what may move under the scroll parallax, and
 * that none of it disturbs the intro's entrance markers.
 *
 * jsdom 25 has no PointerEvent: testing-library falls back to a plain Event and drops
 * `pointerType` and the coordinates, so they are defined by hand (as in pointer-tilt.test).
 * React builds `onPointerEnter` / `onPointerLeave` from the native `pointerover` /
 * `pointerout`. requestAnimationFrame is a manual queue.
 */

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/api", () => ({
  fetchContent: vi.fn(),
}));

import * as api from "@/lib/api";
import { Hero } from "@/components/sections/Hero";
import { INTRO_REVEAL_ATTR } from "@/lib/intro";
import { RequestFlowProvider } from "@/lib/request/RequestFlowProvider";
import { PARALLAX_LAYERS, readSceneInput, resetSceneForTests } from "@/lib/scene";
import { SiteContentProvider, defaultSiteData } from "@/lib/siteContent";
import { REDUCED_MOTION_QUERY, TILT_MAX, TILT_QUERY } from "@/lib/tilt";

const media = { fine: false, reduced: false };
const realMatchMedia = window.matchMedia;

function installMatchMedia() {
  window.matchMedia = ((query: string) => ({
    get matches() {
      if (query === TILT_QUERY) return media.fine;
      if (query === REDUCED_MOTION_QUERY) return media.reduced;
      return false;
    },
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

function flushFrames() {
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(performance.now());
}

beforeEach(() => {
  resetSceneForTests();
  media.fine = false;
  media.reduced = false;
  installMatchMedia();
  frames = new Map();
  nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    nextFrame += 1;
    frames.set(nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
  window.localStorage.clear();
  vi.mocked(api.fetchContent).mockReset();
  vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.matchMedia = realMatchMedia;
  resetSceneForTests();
});

function renderHero(coreArt?: ReactNode) {
  return render(
    <SiteContentProvider>
      <RequestFlowProvider>
        <Hero coreArt={coreArt} />
      </RequestFlowProvider>
    </SiteContentProvider>,
  );
}

type Pointer = "mouse" | "touch" | "pen";

function pointer(
  kind: "pointerOver" | "pointerMove" | "pointerOut",
  el: Element,
  pointerType: Pointer,
  x = 0,
  y = 0,
) {
  const event =
    kind === "pointerOut"
      ? createEvent.pointerOut(el, { relatedTarget: document.body })
      : createEvent[kind](el);
  Object.defineProperty(event, "pointerType", { value: pointerType });
  Object.defineProperty(event, "clientX", { value: x });
  Object.defineProperty(event, "clientY", { value: y });
  fireEvent(el, event);
}

const PRIMARY = "Începe proiectul";
const SECONDARY = "Explorăm serviciile ↓";

const statsMarker = () =>
  document.querySelector<HTMLElement>(`[${INTRO_REVEAL_ATTR}="stats"]`)!;
const card = (id: string) => document.querySelector<HTMLElement>(`[data-metric="${id}"]`)!;

describe("hero CTAs boost the scene", () => {
  it("a mouse over the primary CTA boosts once and leaving ends it", () => {
    renderHero();
    const cta = screen.getByRole("button", { name: PRIMARY });

    pointer("pointerOver", cta, "mouse");
    expect(readSceneInput()).toMatchObject({ boost: 1, waveSeq: 1 });

    pointer("pointerOut", cta, "mouse");
    expect(readSceneInput()).toMatchObject({ boost: 0, waveSeq: 1 });
    // A hover opens nothing.
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
  });

  it("a finger never boosts (a tap has no hover to end it); a pen does", () => {
    renderHero();
    const cta = screen.getByRole("button", { name: PRIMARY });

    pointer("pointerOver", cta, "touch");
    expect(readSceneInput()).toMatchObject({ boost: 0, waveSeq: 0 });
    pointer("pointerOut", cta, "touch");
    expect(readSceneInput()).toMatchObject({ boost: 0, waveSeq: 0 });

    pointer("pointerOver", cta, "pen");
    expect(readSceneInput()).toMatchObject({ boost: 1, waveSeq: 1 });
  });

  it("keyboard focus on the secondary link boosts, blur ends it", () => {
    renderHero();
    const link = screen.getByRole("link", { name: SECONDARY });

    act(() => link.focus());
    expect(readSceneInput()).toMatchObject({ boost: 1, waveSeq: 1 });
    act(() => link.blur());
    expect(readSceneInput()).toMatchObject({ boost: 0, waveSeq: 1 });
  });

  it("moving from one CTA to the other keeps one boost and one light wave", () => {
    renderHero();
    const cta = screen.getByRole("button", { name: PRIMARY });
    const link = screen.getByRole("link", { name: SECONDARY });

    pointer("pointerOver", cta, "mouse");
    pointer("pointerOver", link, "mouse");
    pointer("pointerOut", cta, "mouse");
    expect(readSceneInput()).toMatchObject({ boost: 1, waveSeq: 1 });
    pointer("pointerOut", link, "mouse");
    expect(readSceneInput()).toMatchObject({ boost: 0, waveSeq: 1 });
  });

  it("unmounting while hovered releases the boost", () => {
    const { unmount } = renderHero();
    pointer("pointerOver", screen.getByRole("button", { name: PRIMARY }), "mouse");
    expect(readSceneInput().boost).toBe(1);

    unmount();
    expect(readSceneInput().boost).toBe(0);
  });
});

/*
 * Focus boosts only when it is `:focus-visible`. jsdom treats every focus as visible (nwsapi
 * matches `:focus-visible` like `:focus`), so a browser's "this focus came from a script after a
 * mouse interaction" is simulated by answering `:focus-visible` false for the element.
 */
function focusNotVisible(el: HTMLElement) {
  const real = el.matches.bind(el);
  el.matches = (selector: string) => (selector === ":focus-visible" ? false : real(selector));
}

describe("hero CTA boost — only a visible focus, hover and focus kept apart", () => {
  it("a programmatic focus that is not :focus-visible (the dialog handing focus back after a mouse close) never boosts", () => {
    renderHero();
    const cta = screen.getByRole("button", { name: PRIMARY });
    focusNotVisible(cta);

    act(() => cta.focus());
    expect(document.activeElement).toBe(cta);
    expect(readSceneInput()).toMatchObject({ boost: 0, waveSeq: 0 });
    act(() => cta.blur());
    expect(readSceneInput()).toMatchObject({ boost: 0, waveSeq: 0 });
  });

  it("the lab scenario: hover, click, the dialog closes and refocuses the CTA, the mouse leaves — no boost left behind", () => {
    renderHero();
    const cta = screen.getByRole("button", { name: PRIMARY });

    pointer("pointerOver", cta, "mouse");
    expect(readSceneInput()).toMatchObject({ boost: 1, waveSeq: 1 });
    // The dialog opens: focus leaves, then its close hands focus back by script.
    focusNotVisible(cta);
    act(() => cta.focus());
    pointer("pointerOut", cta, "mouse");
    expect(readSceneInput()).toMatchObject({ boost: 0, waveSeq: 1 });
    expect(document.activeElement).toBe(cta);
  });

  it("a keyboard focus survives the mouse leaving, and a blur while hovered keeps the hover's boost", () => {
    renderHero();
    const cta = screen.getByRole("button", { name: PRIMARY });

    // Keyboard focus, then the mouse passes over and away: still boosted until the blur.
    act(() => cta.focus());
    expect(readSceneInput()).toMatchObject({ boost: 1, waveSeq: 1 });
    pointer("pointerOver", cta, "mouse");
    pointer("pointerOut", cta, "mouse");
    expect(readSceneInput()).toMatchObject({ boost: 1, waveSeq: 1 });
    act(() => cta.blur());
    expect(readSceneInput()).toMatchObject({ boost: 0, waveSeq: 1 });

    // Hovered, then focused and blurred: the hover still holds it, with no second wave.
    pointer("pointerOver", cta, "mouse");
    expect(readSceneInput()).toMatchObject({ boost: 1, waveSeq: 2 });
    act(() => cta.focus());
    act(() => cta.blur());
    expect(readSceneInput()).toMatchObject({ boost: 1, waveSeq: 2 });
    pointer("pointerOut", cta, "mouse");
    expect(readSceneInput()).toMatchObject({ boost: 0, waveSeq: 2 });
  });

  it("unmounting while keyboard-focused releases the boost, and a remount starts clean", () => {
    const first = renderHero();
    act(() => screen.getByRole("button", { name: PRIMARY }).focus());
    expect(readSceneInput().boost).toBe(1);
    first.unmount();
    expect(readSceneInput().boost).toBe(0);

    renderHero();
    const cta = screen.getByRole("button", { name: PRIMARY });
    pointer("pointerOver", cta, "mouse");
    pointer("pointerOut", cta, "mouse");
    // No focus reason left over from the unmounted hero's CTA.
    expect(readSceneInput().boost).toBe(0);
  });
});

describe("stat holograms", () => {
  it("one per card, first child, decorative and text-free", async () => {
    renderHero();
    await screen.findByLabelText("Indicatori");

    const holograms = document.querySelectorAll<HTMLElement>("[data-hologram]");
    expect(holograms).toHaveLength(2);
    expect(card("projects").firstElementChild?.getAttribute("data-hologram")).toBe("octahedron");
    expect(card("automation").firstElementChild?.getAttribute("data-hologram")).toBe("rings");
    for (const hologram of holograms) {
      expect(hologram).toHaveAttribute("aria-hidden", "true");
      expect(hologram.textContent).toBe("");
      expect(hologram.querySelector("[role], [tabindex], a, button")).toBeNull();
      // Edges and rings only: every part is a hairline or a ring, never a small round pip.
      expect(hologram.querySelectorAll("span span").length).toBeGreaterThanOrEqual(4);
    }
    expect(card("projects").querySelectorAll("[data-hologram] span span")).toHaveLength(12);
  });

  it("leaves the metric texts exact (no digits hide in the hologram)", async () => {
    renderHero();
    const metrics = await screen.findByLabelText("Indicatori");
    expect(screen.getByText("24/7")).toBeInTheDocument();
    for (const hologram of metrics.querySelectorAll("[data-hologram]")) {
      expect(hologram.textContent).not.toMatch(/\d/);
    }
  });

  it("an empty portfolio shows one card and one hologram", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({ ...defaultSiteData, projects: [] });
    renderHero();
    await screen.findByText("24/7");
    await vi.waitFor(() => expect(document.querySelectorAll("[data-metric]")).toHaveLength(1));
    expect(document.querySelectorAll("[data-hologram]")).toHaveLength(1);
  });

  it("spins only under a live stage with the intro gone and the hero on screen", () => {
    renderHero();
    const spinner = document.querySelector("[data-hologram] > span")!;
    const classes = spinner.getAttribute("class") ?? "";
    expect(classes).toContain("animate-holo-spin");
    expect(classes).toContain("[animation-play-state:paused]");
    expect(classes).toContain(
      "[html:not(:has(#tbs-intro))_[data-motion=live]_#top:not([data-offscreen])_&]:[animation-play-state:running]",
    );
    expect(classes).toContain("motion-reduce:animate-none");
  });
});

describe("stat card tilt", () => {
  const rect = { left: 100, top: 100, width: 200, height: 100 };

  function mockRect(el: HTMLElement) {
    el.getBoundingClientRect = () =>
      ({ ...rect, x: rect.left, y: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height }) as DOMRect;
  }

  it("cards are off in jsdom (no fine, hovering pointer)", async () => {
    renderHero();
    await screen.findByLabelText("Indicatori");
    for (const el of document.querySelectorAll("[data-metric]")) {
      expect(el).toHaveAttribute("data-tilt", "off");
    }
    expect(statsMarker()).not.toHaveAttribute("data-tilt");
  });

  it("a mouse tilts the card it is over — never the stats marker", async () => {
    media.fine = true;
    renderHero();
    await screen.findByLabelText("Indicatori");
    const target = card("automation");
    expect(target).toHaveAttribute("data-tilt", "on");
    mockRect(target);

    pointer("pointerOver", target, "mouse", 300, 100);
    pointer("pointerMove", target, "mouse", 300, 100);
    act(() => flushFrames());

    expect(target).toHaveAttribute("data-tilting");
    expect(target.style.getPropertyValue("--tilt-rx")).toBe(`${TILT_MAX.metric}deg`);
    expect(target.style.getPropertyValue("--tilt-ry")).toBe(`${TILT_MAX.metric}deg`);
    expect(statsMarker().hasAttribute("style")).toBe(false);
    expect(statsMarker().hasAttribute("data-tilting")).toBe(false);
    expect(target.getAttribute("class")).toContain(
      "data-tilting:[transform:perspective(900px)_rotateX(var(--tilt-rx))_rotateY(var(--tilt-ry))]",
    );

    pointer("pointerOut", target, "mouse");
    expect(target).not.toHaveAttribute("data-tilting");
    expect(target.style.getPropertyValue("--tilt-rx")).toBe("");
    expect(target.style.getPropertyValue("--tilt-ry")).toBe("");
    expect(target.hasAttribute("style")).toBe(false);
  });

  it("reduced motion: off, and a mouse writes nothing", async () => {
    media.fine = true;
    media.reduced = true;
    renderHero();
    await screen.findByLabelText("Indicatori");
    const target = card("automation");
    expect(target).toHaveAttribute("data-tilt", "off");
    mockRect(target);

    pointer("pointerOver", target, "mouse", 120, 110);
    pointer("pointerMove", target, "mouse", 120, 110);
    act(() => flushFrames());

    expect(target).not.toHaveAttribute("data-tilting");
    expect(target.style.getPropertyValue("--tilt-rx")).toBe("");
  });
});

describe("hero hosts in the interior stage", () => {
  it("scene-hero is inside the grid marker, before the h1, and holds the core art", () => {
    renderHero(<svg data-core-art="" aria-hidden="true" focusable="false" />);
    const grid = document.querySelector(`[${INTRO_REVEAL_ATTR}="grid"]`)!;
    const host = screen.getByTestId("scene-hero");
    const h1 = document.querySelector("h1")!;

    expect(grid.contains(host)).toBe(true);
    expect(host.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(host.contains(h1)).toBe(false);

    const anchor = host.querySelector('[data-scene-anchor="hero"]');
    expect(anchor).not.toBeNull();
    expect(anchor?.querySelector("[data-core-art]")).not.toBeNull();
    // Outside the parallax layer: the core is never moved with the backdrop.
    expect(host.closest("[data-parallax]")).toBeNull();
  });

  it("nothing inside scene-hero is text, focusable, a heading or has a role", () => {
    renderHero(<svg data-core-art="" aria-hidden="true" focusable="false" />);
    const host = screen.getByTestId("scene-hero");
    expect(host.textContent).toBe("");
    expect(host.querySelector("a, button, input, [tabindex], [role], h1, h2, h3, h4, h5, h6")).toBeNull();
    expect(host.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("without art the host is still there, empty", () => {
    renderHero();
    expect(screen.getByTestId("scene-hero").querySelector('[data-scene-anchor="hero"]')?.childElementCount).toBe(0);
  });

  it("parallax layers are exactly hero-backdrop and hero-stats, once each, never a marker", () => {
    renderHero();
    const layers = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    expect(layers.map((el) => el.getAttribute("data-parallax")).sort()).toEqual(
      Object.keys(PARALLAX_LAYERS).sort(),
    );
    for (const el of layers) {
      expect(el.hasAttribute(INTRO_REVEAL_ATTR)).toBe(false);
      expect(el.hasAttribute("data-reveal")).toBe(false);
    }
    const backdrop = document.querySelector('[data-parallax="hero-backdrop"]')!;
    expect(backdrop.parentElement).toBe(document.querySelector(`[${INTRO_REVEAL_ATTR}="grid"]`));
    const stats = document.querySelector('[data-parallax="hero-stats"]')!;
    expect(stats.firstElementChild).toBe(statsMarker());
    // The copy column never moves with the scroll.
    expect(document.querySelector("h1")?.closest("[data-parallax]")).toBeNull();
  });

  it("paint order: the section is no stacking context, the plate comes first, the scrim after the marker", () => {
    renderHero();
    const section = document.querySelector<HTMLElement>("section#top")!;
    const classes = (section.getAttribute("class") ?? "").split(/\s+/);
    expect(classes).not.toContain("isolate");
    expect(classes).not.toContain("bg-bg");
    expect(classes).toEqual(expect.arrayContaining(["group/hero", "relative", "overflow-hidden"]));

    const plate = section.firstElementChild!;
    expect(plate).toHaveAttribute("aria-hidden", "true");
    expect((plate.getAttribute("class") ?? "").split(/\s+/)).toEqual(
      expect.arrayContaining(["absolute", "inset-0", "-z-20", "bg-bg", "pointer-events-none"]),
    );
    const grid = plate.nextElementSibling!;
    expect(grid.getAttribute(INTRO_REVEAL_ATTR)).toBe("grid");
    const scrim = grid.nextElementSibling!;
    expect(scrim).toHaveAttribute("data-scene-scrim");
    expect(scrim).toHaveAttribute("aria-hidden", "true");
    expect(scrim.getAttribute("class")).toContain("md:hidden");
  });

  it("keeps the eight-marker contract: the hero's six markers once each, none styled, one h1", async () => {
    media.fine = true;
    renderHero(<svg data-core-art="" aria-hidden="true" focusable="false" />);
    await screen.findByLabelText("Indicatori");
    pointer("pointerOver", card("automation"), "mouse", 10, 10);
    pointer("pointerMove", card("automation"), "mouse", 10, 10);
    act(() => flushFrames());

    for (const name of ["grid", "eyebrow", "title", "lead", "cta", "stats"]) {
      const found = document.querySelectorAll(`[${INTRO_REVEAL_ATTR}="${name}"]`);
      expect(found, name).toHaveLength(1);
      expect(found[0].hasAttribute("style"), name).toBe(false);
    }
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });
});
