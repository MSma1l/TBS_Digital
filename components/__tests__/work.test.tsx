import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { act, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({
  fetchContent: vi.fn(),
}));

import * as api from "@/lib/api";
import { SiteContentProvider, defaultSiteData, type ProjectItem } from "@/lib/siteContent";
import { projects as defaultProjects } from "@/lib/content";
import { Work } from "@/components/sections/Work";
import { Hero } from "@/components/sections/Hero";
import { RequestFlowProvider } from "@/lib/request/RequestFlowProvider";
import { TILT_QUERY } from "@/lib/tilt";

// <Reveal> constructs an IntersectionObserver, which jsdom doesn't implement.
beforeAll(() => {
  class IOStub implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", IOStub);
});

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(api.fetchContent).mockReset();
  // Default: the API is unreachable, so the provider keeps the built-in defaults.
  vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
});

/* Both providers the app puts above these sections: the content store they read, and the
   request flow the hero's CTA opens (`app/layout.tsx`). */
function withProvider(node: ReactNode) {
  return render(
    <SiteContentProvider>
      <RequestFlowProvider>{node}</RequestFlowProvider>
    </SiteContentProvider>,
  );
}

const project = (over: Partial<ProjectItem>): ProjectItem => ({
  id: "p",
  name: "Proiect",
  tag: { ro: "TAG", ru: "TAG", en: "TAG" },
  desc: { ro: "Descriere", ru: "Описание", en: "Description" },
  url: "",
  appStore: "",
  playStore: "",
  images: [],
  ...over,
});

/** Every project card, whether it rendered as a link or as a plain <article>. */
function cards(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>("#lucrari a, #lucrari article"),
  );
}

function cardFor(container: HTMLElement, name: string): HTMLElement {
  const card = cards(container).find(
    (el) => within(el).queryByRole("heading", { name })?.textContent === name,
  );
  if (!card) throw new Error(`no card for "${name}"`);
  return card;
}

describe("Work section — content comes from the store", () => {
  it("renders the portfolio from useSiteContent, not from a constant in the component", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      projects: [project({ id: "only-one", name: "SINGURUL PROIECT" })],
    });

    const { container } = withProvider(<Work />);

    expect(await screen.findByText("SINGURUL PROIECT")).toBeInTheDocument();
    // The seeded portfolio was fully replaced by what the store returned — proof the
    // section reads the store rather than a hardcoded list.
    expect(screen.queryByText("BizCheck")).not.toBeInTheDocument();
    expect(cards(container)).toHaveLength(1);
  });

  it("renders every seeded project when the API is unreachable", async () => {
    const { container } = withProvider(<Work />);

    expect(await screen.findByText("BizCheck")).toBeInTheDocument();
    expect(cards(container)).toHaveLength(defaultProjects.length);
    for (const p of defaultProjects) {
      expect(screen.getByText(p.name)).toBeInTheDocument();
    }
  });

  it("numbers the cards from their position, so a shorter list renumbers", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      projects: [
        project({ id: "a", name: "Primul" }),
        project({ id: "b", name: "Al doilea" }),
      ],
    });

    const { container } = withProvider(<Work />);
    await screen.findByText("Primul");

    expect(cardFor(container, "Primul")).toHaveTextContent("01");
    expect(cardFor(container, "Al doilea")).toHaveTextContent("02");
  });
});

describe("Work section — links and image fallback", () => {
  it("links only the projects that have a real url", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      projects: [
        project({ id: "public", name: "Public", url: "https://example.md" }),
        project({ id: "privat", name: "Privat", url: "" }),
      ],
    });

    const { container } = withProvider(<Work />);
    await screen.findByText("Public");

    const linked = cardFor(container, "Public");
    expect(linked.tagName).toBe("A");
    expect(linked).toHaveAttribute("href", "https://example.md");
    expect(linked).toHaveAttribute("rel", "noopener noreferrer");

    // No url ⇒ not an anchor at all, so there is no link pointing nowhere.
    const unlinked = cardFor(container, "Privat");
    expect(unlinked.tagName).toBe("ARTICLE");
    expect(container.querySelectorAll("#lucrari a")).toHaveLength(1);
  });

  it("falls back to the card's colour gradient when a project has no image", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      projects: [
        project({ id: "cu-imagine", name: "Cu imagine", images: ["/projects/flirt-1.png"] }),
        project({ id: "fara-imagine", name: "Fără imagine", images: [] }),
      ],
    });

    const { container } = withProvider(<Work />);
    await screen.findByText("Fără imagine");

    const withImage = cardFor(container, "Cu imagine");
    expect(within(withImage).getByRole("img")).toHaveAttribute(
      "src",
      "/projects/flirt-1.png",
    );

    const noImage = cardFor(container, "Fără imagine");
    expect(within(noImage).queryByRole("img")).not.toBeInTheDocument();
    // Still a finished, coloured card — the gradient variables the CSS paints are set.
    expect(noImage.style.getPropertyValue("--p1")).toMatch(/^#[0-9a-f]{6}$/i);
    expect(noImage.style.getPropertyValue("--p2")).toMatch(/^#[0-9a-f]{6}$/i);
    // …and its name and description are still there, so it is not an empty box.
    expect(within(noImage).getByRole("heading", { name: "Fără imagine" })).toBeInTheDocument();
    expect(within(noImage).getByText("Descriere")).toBeInTheDocument();
  });

  it("keeps each seeded project's own gradient regardless of its position", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      projects: [project({ id: "flirt", name: "FLIRT" })],
    });

    const { container } = withProvider(<Work />);
    await screen.findByText("FLIRT");

    expect(cardFor(container, "FLIRT").style.getPropertyValue("--p2")).toBe("#ff2d78");
  });

  /* ---- the HUD cards: tilt, parallax and tag chips ---------------------------------------
     jsdom has no PointerEvent (testing-library falls back to a plain Event and drops
     `pointerType` and the coordinates, so they are defined by hand), no matchMedia match and
     no layout; the frames of the tilt hook are a manual queue. */

  function pointer(
    kind: "pointerOver" | "pointerMove" | "pointerOut",
    el: HTMLElement,
    pointerType: "mouse" | "touch",
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

  it("renders every card with the tilt off until a fine, hovering mouse is known", async () => {
    const { container } = withProvider(<Work />);
    await screen.findByText("BizCheck");

    const all = cards(container);
    expect(all).toHaveLength(defaultProjects.length);
    for (const card of all) expect(card).toHaveAttribute("data-tilt", "off");
  });

  it("a mouse tilt writes its angles next to --p1/--p2 on the card root, and settles back to them", async () => {
    const realMatchMedia = window.matchMedia;
    const realRequestFrame = window.requestAnimationFrame;
    const realCancelFrame = window.cancelAnimationFrame;
    const frames = new Map<number, FrameRequestCallback>();
    let lastFrame = 0;
    window.matchMedia = ((query: string) => ({
      matches: query === TILT_QUERY,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      lastFrame += 1;
      frames.set(lastFrame, callback);
      return lastFrame;
    };
    window.cancelAnimationFrame = (id: number) => {
      frames.delete(id);
    };
    const flushFrames = () =>
      act(() => {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback(0);
      });

    try {
      vi.mocked(api.fetchContent).mockResolvedValue({
        ...defaultSiteData,
        projects: [project({ id: "flirt", name: "FLIRT", images: ["/projects/flirt-1.png"] })],
      });
      const { container } = withProvider(<Work />);
      await screen.findByText("FLIRT");

      const card = cardFor(container, "FLIRT");
      expect(card).toHaveAttribute("data-tilt", "on");
      card.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 300, height: 200, x: 0, y: 0, right: 300, bottom: 200 }) as DOMRect;

      // A finger never tilts.
      pointer("pointerMove", card, "touch", 300, 0);
      flushFrames();
      expect(card).not.toHaveAttribute("data-tilting");

      // The mouse at the top-right corner: the full project tilt on both axes.
      pointer("pointerOver", card, "mouse", 300, 0);
      pointer("pointerMove", card, "mouse", 300, 0);
      flushFrames();
      expect(card).toHaveAttribute("data-tilting");
      expect(card.style.getPropertyValue("--tilt-rx")).toBe("6deg");
      expect(card.style.getPropertyValue("--tilt-ry")).toBe("6deg");
      expect(card.style.getPropertyValue("--p1")).toBe("#1a0510");
      expect(card.style.getPropertyValue("--p2")).toBe("#ff2d78");

      pointer("pointerOut", card, "mouse");
      expect(card).not.toHaveAttribute("data-tilting");
      expect(card.style.getPropertyValue("--tilt-rx")).toBe("");
      expect(card.style.getPropertyValue("--tilt-ry")).toBe("");
      expect(card.style.getPropertyValue("--p1")).toBe("#1a0510");
      expect(card.style.getPropertyValue("--p2")).toBe("#ff2d78");
    } finally {
      window.matchMedia = realMatchMedia;
      window.requestAnimationFrame = realRequestFrame;
      window.cancelAnimationFrame = realCancelFrame;
    }
  });

  it("gives each screenshot exactly one parallax wrapper, which keeps the image's role; a card without one has none", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      projects: [
        project({ id: "cu-imagine", name: "Cu imagine", url: "https://example.md", images: ["/projects/flirt-1.png"] }),
        project({ id: "fara-imagine", name: "Fără imagine", images: [] }),
      ],
    });

    const { container } = withProvider(<Work />);
    await screen.findByText("Fără imagine");

    // The view timeline the wrappers play across is named on the section itself.
    expect(container.querySelector("#lucrari")).toHaveClass("view-work");
    expect(container.querySelectorAll('#lucrari [data-parallax="work-media"]')).toHaveLength(1);

    const withImage = cardFor(container, "Cu imagine");
    const layers = withImage.querySelectorAll<HTMLElement>('[data-parallax="work-media"]');
    expect(layers).toHaveLength(1);
    expect(layers[0]).toHaveClass("parallax-media");
    expect(layers[0]).toContainElement(within(withImage).getByRole("img"));
    // Never inside an aria-hidden layer: the screenshot stays an image with its alt.
    expect(layers[0].closest("[aria-hidden]")).toBeNull();

    const noImage = cardFor(container, "Fără imagine");
    expect(noImage.querySelectorAll("[data-parallax]")).toHaveLength(0);
  });

  it("splits a tag into chips on its middots and keeps the · between them, so the card reads the tag as written", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      projects: [
        project({
          id: "privat",
          name: "Privat",
          url: "https://example.md",
          tag: { ro: "CRM PRIVAT · FĂRĂ LINK · 2024", ru: "CRM · БЕЗ ССЫЛКИ", en: "CRM · NO LINK" },
        }),
        project({ id: "unul", name: "Unul", tag: { ro: "PLATFORMĂ WEB", ru: "ВЕБ", en: "WEB" } }),
      ],
    });

    const { container } = withProvider(<Work />);
    await screen.findByText("Privat");

    const card = cardFor(container, "Privat");
    const tag = card.querySelector("small");
    // Chip, separator, chip, separator, chip: the admin's "·" stays visible between chips
    // (decision D7), as text — never an aria-hidden decoration.
    expect(Array.from(tag?.children ?? [], (el) => el.textContent)).toEqual([
      "CRM PRIVAT",
      " · ",
      "FĂRĂ LINK",
      " · ",
      "2024",
    ]);
    expect(tag?.textContent).toBe("CRM PRIVAT · FĂRĂ LINK · 2024");
    expect(tag?.querySelector("[aria-hidden]")).toBeNull();
    // …so the link's accessible name keeps a boundary between two tags.
    expect(card).toHaveAccessibleName(expect.stringContaining("CRM PRIVAT · FĂRĂ LINK · 2024"));

    // A one-segment tag is one chip and no separator.
    const single = cardFor(container, "Unul").querySelector("small");
    expect(Array.from(single?.children ?? [], (el) => el.textContent)).toEqual(["PLATFORMĂ WEB"]);
  });

  it("the tag chips carry no backdrop blur (they sit over the parallax screenshot)", async () => {
    const { container } = withProvider(<Work />);
    await screen.findByText("BizCheck");

    const chips = Array.from(container.querySelectorAll<HTMLElement>("#lucrari small > span"));
    expect(chips.length).toBeGreaterThanOrEqual(defaultProjects.length);
    for (const chip of chips) expect(chip.getAttribute("class") ?? "").not.toMatch(/backdrop-blur/);
  });
});

describe("Work section — the helix track", () => {
  /* The interior scene measures the card grid (`data-work-track`) and, on the WebGL path only,
     lays the cards out round its helix inline (components/scene/workHelix.ts). What the server
     and React render stays the plain grid: nothing positions or transforms a card up front. */
  it("marks the card grid as the scene's track, and renders each card with only its two colours inline", async () => {
    const { container } = withProvider(<Work />);
    expect(await screen.findByText("BizCheck")).toBeInTheDocument();

    const tracks = container.querySelectorAll<HTMLElement>("#lucrari [data-work-track]");
    expect(tracks).toHaveLength(1);
    const track = tracks[0];
    expect(track.getAttribute("data-work-track")).toBe("");
    // The track is the grid itself: every card is a direct child, and it has no inline style.
    expect(track.hasAttribute("style")).toBe(false);
    const all = cards(container);
    expect(all).toHaveLength(defaultProjects.length);
    for (const card of all) {
      expect(card.parentElement).toBe(track);
      expect(card.style.transform).toBe("");
      expect(card.style.position).toBe("");
      expect(card.style.zIndex).toBe("");
      expect(card.style.length).toBe(2);
      expect(card.style.getPropertyValue("--p1")).not.toBe("");
      expect(card.style.getPropertyValue("--p2")).not.toBe("");
    }
    // The heading block (eyebrow → lead) is the track's previous sibling: the ambient helix sits behind it.
    expect(track.previousElementSibling?.querySelector("h2")).not.toBeNull();
  });
});

describe("Hero metrics", () => {
  it("counts the real portfolio instead of claiming a hardcoded number", async () => {
    withProvider(<Hero />);

    const metrics = await screen.findByLabelText("Indicatori");
    expect(
      within(metrics).getByText(String(defaultProjects.length)),
    ).toBeInTheDocument();
    expect(within(metrics).getByText("proiecte în portofoliu")).toBeInTheDocument();
    // The old hand-written claim is gone.
    expect(within(metrics).queryByText("50+")).not.toBeInTheDocument();
  });

  it("follows the store when the portfolio changes", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      projects: [project({ id: "a", name: "A" }), project({ id: "b", name: "B" })],
    });

    withProvider(<Hero />);

    const metrics = await screen.findByLabelText("Indicatori");
    expect(await within(metrics).findByText("2")).toBeInTheDocument();
    expect(
      within(metrics).queryByText(String(defaultProjects.length)),
    ).not.toBeInTheDocument();
  });

  it("shows no counter at all rather than a bare 0 for an empty portfolio", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({ ...defaultSiteData, projects: [] });

    withProvider(<Hero />);

    const metrics = await screen.findByLabelText("Indicatori");
    // The non-portfolio metric stays; the counter disappears.
    expect(await within(metrics).findByText("24/7")).toBeInTheDocument();
    expect(within(metrics).queryByText("0")).not.toBeInTheDocument();
    expect(
      within(metrics).queryByText("proiecte în portofoliu"),
    ).not.toBeInTheDocument();
  });
});
