import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";

/*
 * The hero (components/sections/Hero.tsx): the CTAs that light the static core (pure CSS), the
 * stat cards' tilt, and the core art's host — where it sits in the tree. No WebGL, no scene
 * input, no parallax director (removed 2026-10-28).
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
import { HUD_DESKTOP_MEDIA } from "@/lib/hud/gate";
import { RequestFlowProvider } from "@/lib/request/RequestFlowProvider";
import { SiteContentProvider, defaultSiteData } from "@/lib/siteContent";
import { REDUCED_MOTION_QUERY, TILT_MAX, TILT_QUERY } from "@/lib/tilt";

const media = { fine: false, reduced: false, desktop: false };
const realMatchMedia = window.matchMedia;

function installMatchMedia() {
  window.matchMedia = ((query: string) => ({
    get matches() {
      if (query === TILT_QUERY) return media.fine;
      if (query === REDUCED_MOTION_QUERY) return media.reduced;
      if (query === HUD_DESKTOP_MEDIA) return media.desktop;
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
  media.fine = false;
  media.reduced = false;
  media.desktop = false;
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

const PRIMARY = "Cere ofertă";
const SECONDARY = "Vezi serviciile ↓";

const statsMarker = () => document.querySelector<HTMLElement>('[role="group"]')!;
/** The decorative backdrop layer: the hero's second child, after the opaque plate. */
const gridLayer = () =>
  document.querySelector<HTMLElement>("section#top")!.firstElementChild!.nextElementSibling as HTMLElement;
const card = (id: string) => document.querySelector<HTMLElement>(`[data-metric="${id}"]`)!;

describe("hero CTAs light the core in CSS", () => {
  it("both CTAs carry the hook the core art's CSS keys its one-shot wave off", () => {
    renderHero();
    expect(screen.getByRole("button", { name: PRIMARY })).toHaveAttribute("data-hero-cta", "");
    expect(screen.getByRole("link", { name: SECONDARY })).toHaveAttribute("data-hero-cta", "");
  });
});

describe("stat cards and their CSS holograms", () => {
  it("each card carries one wireframe hologram (CSS 3D, aria-hidden, text-free) and no scene anchor", async () => {
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
    }
    expect(card("projects").querySelectorAll("[data-hologram] span span")).toHaveLength(12);
    expect(document.querySelector("[data-scene-anchor], [data-stats-group], [data-parallax]")).toBeNull();
    expect(card("projects").querySelector("b")?.textContent).toBe(String(defaultSiteData.projects.length));
  });

  it("spins with no WebGL gate: paused only while the hero is off screen, dropped under reduced motion", () => {
    renderHero();
    const classes = document.querySelector("[data-hologram] > span")!.getAttribute("class") ?? "";
    expect(classes).toContain("animate-holo-spin");
    expect(classes).toContain("group-data-offscreen/hero:[animation-play-state:paused]");
    expect(classes).toContain("motion-reduce:animate-none");
    expect(classes).not.toContain("data-motion");
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

describe("the hero's core host", () => {
  it("hero-core is inside the backdrop layer, before the h1, and holds the core art", () => {
    renderHero(<svg data-core-art="" aria-hidden="true" focusable="false" />);
    const host = screen.getByTestId("hero-core");
    const h1 = document.querySelector("h1")!;
    expect(gridLayer().contains(host)).toBe(true);
    expect(host.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(host.contains(h1)).toBe(false);
    expect(host.querySelector("[data-core-art]")).not.toBeNull();
  });

  it("nothing inside hero-core is text, focusable, a heading or has a role", () => {
    renderHero(<svg data-core-art="" aria-hidden="true" focusable="false" />);
    const host = screen.getByTestId("hero-core");
    expect(host.textContent).toBe("");
    expect(host.querySelector("a, button, input, [tabindex], [role], h1, h2, h3, h4, h5, h6")).toBeNull();
    expect(host.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("without art the host is still there, empty", () => {
    renderHero();
    expect(screen.getByTestId("hero-core").firstElementChild?.childElementCount).toBe(0);
  });

  it("paint order: the plate comes first, then the backdrop, then the phone scrim", () => {
    renderHero();
    const section = document.querySelector<HTMLElement>("section#top")!;
    const classes = (section.getAttribute("class") ?? "").split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(["group/hero", "relative", "overflow-hidden"]));

    const plate = section.firstElementChild!;
    expect(plate).toHaveAttribute("aria-hidden", "true");
    expect((plate.getAttribute("class") ?? "").split(/\s+/)).toEqual(
      expect.arrayContaining(["absolute", "inset-0", "-z-20", "bg-bg", "pointer-events-none"]),
    );
    const scrim = gridLayer().nextElementSibling!;
    expect(scrim).toHaveAttribute("aria-hidden", "true");
    expect(scrim.getAttribute("class")).toContain("md:hidden");
  });

  it("leaves the hero's layers unstyled under a tilt, with one h1", async () => {
    media.fine = true;
    renderHero(<svg data-core-art="" aria-hidden="true" focusable="false" />);
    await screen.findByLabelText("Indicatori");
    pointer("pointerOver", card("automation"), "mouse", 10, 10);
    pointer("pointerMove", card("automation"), "mouse", 10, 10);
    act(() => flushFrames());

    expect(gridLayer().hasAttribute("style")).toBe(false);
    expect(statsMarker().hasAttribute("style")).toBe(false);
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });
});
