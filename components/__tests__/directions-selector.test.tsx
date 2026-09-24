/**
 * The /02 block is the direction CHOOSER.
 *
 * Two things it must never go back to being: pills that look clickable and do nothing
 * (they are links to `/servicii/<slug>` now), and a preview with two competing CTAs.
 * Everything commercial belongs on the service page, so the only interactive element left
 * in the preview is the single "open the service" link.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, createEvent, render, screen, waitFor, within, fireEvent } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  fetchContent: vi.fn(),
}));

import * as api from "@/lib/api";
import { SiteContentProvider } from "@/lib/siteContent";
import { Directions, pillIndexForKey } from "@/components/sections/Directions";
import { ServiceArt } from "@/components/scene/art/ServiceArt";
import { directions } from "@/lib/directions";
import { SCENE_SHAPES, readSceneInput, resetSceneForTests, selectSceneShape } from "@/lib/scene";
import { solutions } from "@/lib/solutions";

beforeEach(() => {
  window.localStorage.clear();
  // API unreachable → the provider keeps the built-in portfolio defaults.
  vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
});

function renderSection(): HTMLElement {
  const { container } = render(
    <SiteContentProvider>
      <Directions />
    </SiteContentProvider>,
  );
  return container;
}

/** The pill row — a <nav>, since the pills are links rather than tabs. */
function pills(): HTMLAnchorElement[] {
  const nav = screen.getByRole("navigation", { name: "Direcțiile de servicii" });
  return within(nav).getAllByRole("link") as HTMLAnchorElement[];
}

describe("direction selector — every pill is a real link", () => {
  it("renders one link per direction, pointing at that direction's page", () => {
    renderSection();
    const links = pills();

    expect(links).toHaveLength(directions.length);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/servicii/produs-digital",
      "/servicii/e-commerce",
      "/servicii/automatizare-api",
      "/servicii/asistenti-ia",
      "/servicii/brand-ui",
    ]);
  });

  it("leaves no inert pill behind — nothing in the row is a bare <button>", () => {
    renderSection();
    const nav = screen.getByRole("navigation", { name: "Direcțiile de servicii" });
    expect(within(nav).queryAllByRole("button")).toHaveLength(0);
  });

  it("names each pill by its label alone — the selected pill's ↗ cue is never read", () => {
    renderSection();
    const links = pills();
    const labels = ["Produs digital", "E-commerce", "Automatizare & API", "Asistenți IA & boturi", "Brand & UI"];

    // Every selection state, the default one first: the selected pill carries the ↗ cue.
    for (let selected = 0; selected < links.length; selected += 1) {
      fireEvent.pointerMove(links[selected]);
      expect(links[selected]).toHaveAttribute("aria-current", "true");
      expect(links[selected]).toHaveTextContent("↗");
      links.forEach((link, i) => expect(link).toHaveAccessibleName(labels[i]));
    }
  });

  it("marks the selected pill for assistive tech", () => {
    renderSection();
    const links = pills();
    expect(links[0]).toHaveAttribute("aria-current", "true");
    expect(links[4]).not.toHaveAttribute("aria-current");

    fireEvent.pointerMove(links[4]);
    expect(links[4]).toHaveAttribute("aria-current", "true");
    expect(links[0]).not.toHaveAttribute("aria-current");
  });

  /* The pills select on a real MOVEMENT over them, never on arriving under the pointer: a row
     scrolling past a parked cursor gets the boundary events anyway, and selecting on those would
     change the direction — and with it the scene's 3D model — for a visitor who pointed at
     nothing. Fixed 2026-09-19 (1f16576), the same mistake as the service pages' project reel. */
  it("a pill that scrolls under a parked cursor selects nothing", () => {
    renderSection();
    const links = pills();
    expect(links[0]).toHaveAttribute("aria-current", "true");

    // Exactly what a stationary cursor gets as the row moves under it: boundary events, no move.
    fireEvent.pointerOver(links[3]);
    fireEvent.pointerEnter(links[3]);
    fireEvent.mouseOver(links[3]);
    fireEvent.mouseEnter(links[3]);

    expect(links[3]).not.toHaveAttribute("aria-current");
    expect(links[0]).toHaveAttribute("aria-current", "true");

    // One real pixel of movement over it, and it selects.
    fireEvent.pointerMove(links[3]);
    expect(links[3]).toHaveAttribute("aria-current", "true");
  });
});

describe("direction selector — the preview follows the selection", () => {
  it("swaps the preview copy when another direction is selected", () => {
    const container = renderSection();
    // A real click on a real link — jsdom would try to navigate, which it cannot do.
    container.addEventListener("click", (e) => e.preventDefault());
    const links = pills();

    // first direction
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Produs digital");
    expect(screen.getByText("Workshop de strategie")).toBeInTheDocument();

    fireEvent.click(links[4]); // Brand & UI

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Brand & UI");
    expect(screen.getByText("Design system")).toBeInTheDocument();
    expect(screen.queryByText("Workshop de strategie")).not.toBeInTheDocument();
  });

  it("keeps the short description visible for every direction", () => {
    renderSection();
    const links = pills();
    for (let i = 0; i < links.length; i += 1) {
      fireEvent.pointerMove(links[i]);
      const panelText = screen.getByRole("heading", { level: 3 }).parentElement;
      expect(panelText?.querySelector("p")?.textContent?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it("shows the direction's OWN reference project, not one borrowed from elsewhere", async () => {
    renderSection();
    const links = pills();

    expect(await screen.findByText("BizCheck")).toBeInTheDocument();

    fireEvent.pointerMove(links[4]); // Brand & UI → Itara Global
    expect(screen.getByText("Itara Global")).toBeInTheDocument();
    expect(screen.queryByText("BizCheck")).not.toBeInTheDocument();
  });

  it("the reference card keeps the tag's · between its chips, as text", async () => {
    const container = renderSection();
    fireEvent.pointerMove(pills()[2]); // automatizare-api → Crowe Portal, "CRM PRIVAT · FĂRĂ LINK"

    expect(await screen.findByText("CRM PRIVAT")).toBeInTheDocument();
    const row = screen.getByText("CRM PRIVAT").parentElement!;
    expect(Array.from(row.children, (el) => el.textContent)).toEqual(["CRM PRIVAT", " · ", "FĂRĂ LINK"]);
    expect(row.textContent).toBe("CRM PRIVAT · FĂRĂ LINK");
    expect(row.querySelector("[aria-hidden]")).toBeNull();
    expect(container.querySelector("article")?.textContent).toContain("CRM PRIVAT · FĂRĂ LINK");

    // A one-segment tag: one chip, no separator.
    fireEvent.pointerMove(pills()[0]); // produs-digital → BizCheck, "PLATFORMĂ WEB"
    const single = screen.getByText("PLATFORMĂ WEB").parentElement!;
    expect(Array.from(single.children, (el) => el.textContent)).toEqual(["PLATFORMĂ WEB"]);
  });

  /* e-commerce is sold as a CAPABILITY: no shop has shipped, so the card draws the flow we
     build instead of naming a project — and it no longer tells the visitor there is
     nothing, which read as an apology on a sales page. */
  it("draws the flow for a capability direction, naming no project and linking nowhere", () => {
    const container = renderSection();
    fireEvent.pointerMove(pills()[1]); // e-commerce

    expect(screen.getByText("FLUXUL PE CARE ÎL CONSTRUIM")).toBeInTheDocument();
    expect(screen.getByText("Ofertă → Plată → Acces")).toBeInTheDocument();
    const steps = Array.from(container.querySelectorAll("ol li span")).map(
      (el) => el.textContent,
    );
    expect(steps).toEqual([
      "Ofertă — produsul, raportul sau accesul, prezentate clar.",
      "Plată — un checkout scurt, cu metodele potrivite pieței tale.",
      "Acces — livrare digitală sau cont cu tot ce a cumpărat clientul.",
    ]);

    // …and no portfolio project is borrowed to fill the card.
    for (const name of ["BizCheck", "Balloons Breeze", "Itara Global", "CGAM"]) {
      expect(screen.queryByText(name)).toBeNull();
    }
  });

  it("no longer tells the visitor a direction is empty — both filled directions show real content", () => {
    renderSection();
    const empty = "Pe această direcție nu avem încă un proiect public în portofoliu.";

    for (const index of [1, 3]) {
      fireEvent.pointerMove(pills()[index]); // e-commerce, then assistants
      expect(screen.queryByText(empty)).toBeNull();
    }
  });

  it("shows the two real assistant/bot projects on the assistants direction", async () => {
    renderSection();
    fireEvent.pointerMove(pills()[3]); // asistenti-ia

    // The reference card is the first curated project of the direction.
    expect(await screen.findByText("BizCheck")).toBeInTheDocument();
    expect(screen.getByText("PROIECT REAL DIN PORTOFOLIU")).toBeInTheDocument();
  });
});

describe("direction selector — one action, not two", () => {
  it("offers exactly one link out of the preview, into the selected service page", () => {
    const container = renderSection();
    const panelLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>("#servicii nav ~ div a"),
    );

    expect(panelLinks).toHaveLength(1);
    expect(panelLinks[0].textContent).toContain("Deschide serviciul");
    expect(panelLinks[0].getAttribute("href")).toBe("/servicii/produs-digital");

    fireEvent.pointerMove(pills()[2]);
    expect(panelLinks[0].getAttribute("href")).toBe("/servicii/automatizare-api");
  });

  /* Claims an audit proved false: a "Contract MD" product that does not exist, a project
     name nobody uses ("Balons Blaze" — the real one is Balloons Breeze), and a bot link
     whose profile shows spam in link previews. None of them may appear on any direction. */
  it("carries none of the disproved claims, on any direction", () => {
    const container = renderSection();

    for (let i = 0; i < pills().length; i += 1) {
      fireEvent.pointerMove(pills()[i]);
      const text = container.textContent ?? "";
      expect(text).not.toContain("Contract MD");
      expect(text).not.toContain("Balons Blaze");
      const hrefs = Array.from(
        container.querySelectorAll<HTMLAnchorElement>("a"),
      ).map((a) => a.getAttribute("href") ?? "");
      expect(hrefs.some((h) => h.includes("t.me/"))).toBe(false);
    }
  });

  it("no longer duplicates the commercial CTA — nothing here jumps to the estimator", () => {
    const container = renderSection();
    const hrefs = Array.from(
      container.querySelectorAll<HTMLAnchorElement>("a"),
    ).map((a) => a.getAttribute("href"));

    expect(hrefs.some((h) => h?.includes("#estimare"))).toBe(false);
    expect(hrefs.some((h) => h?.includes("#contact"))).toBe(false);
  });
});

/* ---- the interior redesign: first tap, arrow keys, the HUD screen ------------------------ */

/**
 * Presses and clicks `el` the way a `pointerType` would. jsdom has no PointerEvent, so the
 * type is defined by hand. The probe listens on `document`, after React's root listener, so it
 * sees whether the section cancelled the navigation (Next's Link would then skip it) — and
 * then cancels it itself, since jsdom cannot navigate.
 */
function tap(el: HTMLElement, pointerType: "touch" | "pen" | "mouse"): { navigated: boolean } {
  let prevented = false;
  const probe = (e: Event) => {
    prevented = e.defaultPrevented;
    e.preventDefault();
  };
  document.addEventListener("click", probe);
  const down = createEvent.pointerDown(el);
  Object.defineProperty(down, "pointerType", { value: pointerType });
  fireEvent(el, down);
  fireEvent.click(el);
  document.removeEventListener("click", probe);
  return { navigated: !prevented };
}

/** A click with no pointer press before it (assistive technology, `element.click()`). */
function syntheticClick(el: HTMLElement): { navigated: boolean } {
  let prevented = false;
  const probe = (e: Event) => {
    prevented = e.defaultPrevented;
    e.preventDefault();
  };
  document.addEventListener("click", probe);
  fireEvent.click(el);
  document.removeEventListener("click", probe);
  return { navigated: !prevented };
}

const screenEl = () => screen.getByTestId("scene-services");

describe("direction selector — a finger selects first, then opens", () => {
  beforeEach(() => {
    resetSceneForTests();
  });

  it("first touch tap on another pill selects without navigating; the second navigates", () => {
    renderSection();
    const links = pills();

    expect(tap(links[1], "touch").navigated).toBe(false);
    expect(links[1]).toHaveAttribute("aria-current", "true");
    expect(links[0]).not.toHaveAttribute("aria-current");
    expect(screenEl()).toHaveAttribute("data-shape", "e-commerce");

    expect(tap(links[1], "touch").navigated).toBe(true);
    expect(links[1]).toHaveAttribute("aria-current", "true");
  });

  it("the already-selected pill opens on the first tap", () => {
    renderSection();
    const links = pills();
    expect(links[0]).toHaveAttribute("aria-current", "true");

    expect(tap(links[0], "touch").navigated).toBe(true);
    expect(links[0]).toHaveAttribute("aria-current", "true");
    expect(screenEl()).toHaveAttribute("data-shape", "produs-digital");
  });

  it("a pill already selected by hover or focus opens on a finger's or a pen's first tap", () => {
    renderSection();
    const links = pills();

    fireEvent.pointerMove(links[2]);
    expect(tap(links[2], "touch").navigated).toBe(true);

    act(() => links[4].focus());
    expect(tap(links[4], "pen").navigated).toBe(true);
  });

  it("only the pill selected when the press starts opens: a swipe that began on it primes no other", () => {
    renderSection();
    const links = pills();

    // A press on the selected pill that became a swipe of the band.
    const down = createEvent.pointerDown(links[0]);
    Object.defineProperty(down, "pointerType", { value: "touch" });
    fireEvent(links[0], down);
    fireEvent.pointerCancel(links[0]);

    expect(tap(links[1], "touch").navigated).toBe(false);
    expect(links[1]).toHaveAttribute("aria-current", "true");
    // The first pill is no longer the selected one: its tap selects again.
    expect(tap(links[0], "touch").navigated).toBe(false);
    expect(links[0]).toHaveAttribute("aria-current", "true");
  });

  it("a pen behaves like a finger", () => {
    renderSection();
    const links = pills();
    expect(tap(links[3], "pen").navigated).toBe(false);
    expect(screenEl()).toHaveAttribute("data-shape", "asistenti-ia");
    expect(tap(links[3], "pen").navigated).toBe(true);
  });

  it("mouse, keyboard and synthetic clicks navigate immediately", () => {
    renderSection();
    const links = pills();

    expect(tap(links[2], "mouse").navigated).toBe(true);
    expect(links[2]).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(links[4], { key: "Enter" });
    expect(syntheticClick(links[4]).navigated).toBe(true);
    expect(links[4]).toHaveAttribute("aria-current", "true");

    expect(syntheticClick(links[1]).navigated).toBe(true);
    expect(links[1]).toHaveAttribute("aria-current", "true");
  });

  it("selecting another pill re-arms the rule", () => {
    renderSection();
    const links = pills();

    expect(tap(links[2], "touch").navigated).toBe(false);
    fireEvent.pointerMove(links[3]);
    expect(links[3]).toHaveAttribute("aria-current", "true");
    expect(tap(links[2], "touch").navigated).toBe(false);
    expect(tap(links[2], "touch").navigated).toBe(true);
  });

  it("a press that turns into a swipe of the band leaves no touch behind for the next click", () => {
    renderSection();
    const links = pills();

    const down = createEvent.pointerDown(links[2]);
    Object.defineProperty(down, "pointerType", { value: "touch" });
    fireEvent(links[2], down);
    fireEvent.pointerCancel(links[2]);
    expect(syntheticClick(links[2]).navigated).toBe(true);
  });

  it("the Open service link is never intercepted", () => {
    const container = renderSection();
    const [open] = Array.from(container.querySelectorAll<HTMLAnchorElement>("#servicii nav ~ div a"));

    expect(tap(open, "touch").navigated).toBe(true);
    expect(tap(open, "pen").navigated).toBe(true);
  });
});

describe("direction selector — arrow keys walk the pills", () => {
  beforeEach(() => {
    resetSceneForTests();
  });

  it("ArrowRight/ArrowLeft move focus and aria-current, wrapping at both ends", () => {
    renderSection();
    const links = pills();
    act(() => links[0].focus());

    for (const expected of [1, 2, 3, 4, 0]) {
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowRight" });
      expect(document.activeElement).toBe(links[expected]);
      expect(links[expected]).toHaveAttribute("aria-current", "true");
    }
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(links[4]);
    expect(links[4]).toHaveAttribute("aria-current", "true");
    expect(links.filter((a) => a.getAttribute("aria-current") === "true")).toHaveLength(1);
  });

  it("Home/End jump to the first/last pill; Up/Down and modified arrows are left alone", () => {
    renderSection();
    const links = pills();
    act(() => links[2].focus());

    // fireEvent returns false when the handler cancelled the default action.
    expect(fireEvent.keyDown(links[2], { key: "End" })).toBe(false);
    expect(document.activeElement).toBe(links[4]);
    expect(fireEvent.keyDown(links[4], { key: "Home" })).toBe(false);
    expect(document.activeElement).toBe(links[0]);

    expect(fireEvent.keyDown(links[0], { key: "ArrowDown" })).toBe(true);
    expect(fireEvent.keyDown(links[0], { key: "ArrowUp" })).toBe(true);
    expect(fireEvent.keyDown(links[0], { key: "ArrowRight", altKey: true })).toBe(true);
    expect(document.activeElement).toBe(links[0]);
    // No new tab stops: the pills stay plain links.
    for (const a of links) expect(a).not.toHaveAttribute("tabindex");
  });

  it("pillIndexForKey", () => {
    expect(pillIndexForKey("ArrowRight", 0, 5)).toBe(1);
    expect(pillIndexForKey("ArrowRight", 4, 5)).toBe(0);
    expect(pillIndexForKey("ArrowLeft", 0, 5)).toBe(4);
    expect(pillIndexForKey("ArrowLeft", 3, 5)).toBe(2);
    expect(pillIndexForKey("Home", 3, 5)).toBe(0);
    expect(pillIndexForKey("End", 1, 5)).toBe(4);
    expect(pillIndexForKey("ArrowDown", 1, 5)).toBeNull();
    expect(pillIndexForKey("ArrowUp", 1, 5)).toBeNull();
    expect(pillIndexForKey("Enter", 1, 5)).toBeNull();
    expect(pillIndexForKey("ArrowRight", 0, 0)).toBeNull();
  });
});

describe("direction selector — the HUD screen and the scene", () => {
  beforeEach(() => {
    resetSceneForTests();
  });

  it("data-shape follows aria-current on a pointer move, focus and click for all 5, and so does the scene", () => {
    const container = renderSection();
    container.addEventListener("click", (e) => e.preventDefault());
    const links = pills();
    const selected = () => links.findIndex((a) => a.getAttribute("aria-current") === "true");

    const moves: Array<(el: HTMLElement) => void> = [
      (el) => fireEvent.pointerMove(el),
      (el) => act(() => el.focus()),
      (el) => fireEvent.click(el),
    ];
    for (const move of moves) {
      for (const i of [4, 2, 0, 3, 1]) {
        move(links[i]);
        expect(selected()).toBe(i);
        expect(screenEl()).toHaveAttribute("data-shape", SCENE_SHAPES[i]);
        expect(readSceneInput().shape).toBe(i);
      }
    }
  });

  it("the page's selection wins over whatever the scene held before", () => {
    selectSceneShape("brand-ui");
    renderSection();
    expect(readSceneInput().shape).toBe(0);
    expect(screenEl()).toHaveAttribute("data-shape", "produs-digital");
  });

  it("the art slot renders only the selected illustration, aria-hidden, adding no link, heading or step", async () => {
    const { container } = render(
      <SiteContentProvider>
        <Directions initialArt={<ServiceArt shape={SCENE_SHAPES[0]} />} />
      </SiteContentProvider>,
    );
    const anchor = container.querySelector<HTMLElement>('[data-scene-anchor="services"]');
    expect(anchor).not.toBeNull();
    expect(anchor).toHaveAttribute("aria-hidden", "true");
    expect(screenEl().contains(anchor)).toBe(true);

    const links = pills();
    for (const [i, slug] of SCENE_SHAPES.entries()) {
      fireEvent.pointerMove(links[i]);
      // The first direction's drawing is the server slot; the others arrive with their chunk.
      await waitFor(() => expect(anchor?.querySelector("[data-shape-art]")).toHaveAttribute("data-shape-art", slug));
      const arts = anchor?.querySelectorAll("[data-shape-art]") ?? [];
      expect(arts).toHaveLength(1);
      expect(arts[0]).toHaveAttribute("data-shape-art", slug);
      expect(anchor?.querySelectorAll("a, button, [tabindex], h1, h2, h3, h4, h5, h6, ol, [role]")).toHaveLength(0);
      expect(anchor?.textContent).toBe("");

      // The same counts the contract tests above read, with the art in place.
      expect(container.querySelectorAll("#servicii nav ~ div a")).toHaveLength(1);
      expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
      expect(container.querySelectorAll("ol li span")).toHaveLength(slug === "e-commerce" ? 3 : 0);
    }
  });

  it("the first direction's drawing is the server slot, there from the first render; switching back reuses it", async () => {
    const { container } = render(
      <SiteContentProvider>
        <Directions initialArt={<svg data-shape-art={SCENE_SHAPES[0]} data-slot="" aria-hidden="true" />} />
      </SiteContentProvider>,
    );
    const anchor = container.querySelector<HTMLElement>('[data-scene-anchor="services"]')!;
    expect(anchor.querySelector("[data-slot]")).toHaveAttribute("data-shape-art", "produs-digital");

    const links = pills();
    fireEvent.pointerMove(links[3]);
    expect(anchor.querySelector("[data-slot]")).toBeNull();
    await waitFor(() => expect(anchor.querySelector("[data-shape-art]")).toHaveAttribute("data-shape-art", "asistenti-ia"));

    fireEvent.pointerMove(links[0]);
    expect(anchor.querySelectorAll("[data-shape-art]")).toHaveLength(1);
    expect(anchor.querySelector("[data-slot]")).toHaveAttribute("data-shape-art", "produs-digital");
  });

  it("a bare render (no initial slot) draws no illustration for any direction", async () => {
    // The host is never empty any more: `ModelLoader` fills it from first paint until the stage
    // decides, because the illustrations became the fallback rather than a preamble. So the claim
    // is about ILLUSTRATIONS — `[data-shape-art]` — not about the host having no children.
    renderSection();
    const anchor = screenEl().querySelector<HTMLElement>('[data-scene-anchor="services"]')!;
    const art = () => anchor.querySelectorAll("[data-shape-art]").length;
    expect(anchor.querySelectorAll("[data-loading]")).toHaveLength(1);
    for (const link of pills()) {
      fireEvent.pointerMove(link);
      expect(art()).toBe(0);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(art()).toBe(0);
  });

  it("the illustration comes before the case card, and nothing on the screen takes focus", () => {
    renderSection();
    const box = screenEl();
    const anchor = box.querySelector('[data-scene-anchor="services"]');
    const card = box.querySelector("article");
    expect(anchor).not.toBeNull();
    expect(card).not.toBeNull();
    expect((anchor as Element).compareDocumentPosition(card as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(box.querySelectorAll("a, button, input, [tabindex]")).toHaveLength(0);
  });
});

/* ---- the glass reveal: `entry-glow` / `entry-sweep` (app/tailwind.css) -------------------- */

describe("direction selector — the glass reveal hooks", () => {
  it("the panel carries entry-glow and its copy column entry-sweep, once each, off every reveal marker", () => {
    const container = renderSection();
    const panel = container.querySelector<HTMLElement>("#servicii nav ~ div");
    const copy = screen.getByRole("heading", { level: 3 }).closest<HTMLElement>(".entry-sweep");

    expect(panel).toHaveClass("entry-glow");
    expect(copy).not.toBeNull();
    expect(copy?.parentElement).toBe(panel);
    expect(container.querySelectorAll(".entry-glow")).toHaveLength(1);
    expect(container.querySelectorAll(".entry-sweep")).toHaveLength(1);
    // The band is the column's ::after: no `after:` utility may write the same pseudo-element.
    expect(copy?.className.split(/\s+/).filter((token) => /(?:^|:)after:/.test(token))).toEqual([]);
    for (const el of [panel, copy]) {
      expect(el?.closest("[data-reveal]")).toBeNull();
      expect(el?.querySelector("[data-reveal]")).toBeNull();
    }
  });

  it("the glow's --accent follows the selected direction", () => {
    const container = renderSection();
    const panel = container.querySelector<HTMLElement>(".entry-glow");
    const links = pills();

    for (const [i, slug] of SCENE_SHAPES.entries()) {
      fireEvent.pointerMove(links[i]);
      expect(panel?.style.getPropertyValue("--accent")).toBe(solutions[slug]?.accent ?? "var(--blue)");
    }
  });
});
