import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_GUIDE_MEMORY,
  GUIDE_LIMITS,
  canPrompt,
  createGuideMemoryStore,
  isFinal,
  isTypingTarget,
  optOut,
  pickTopic,
  recordPrompt,
  type GuideBlockers,
  type GuideMemory,
} from "@/lib/hud/linger";

/*
 * The Ghid TBS linger engine (lib/hud/linger.ts): when a tip may show. The limits (2 per page
 * lifetime, a 60 s cooldown, each topic once, the opt-out), the seven blockers, the deepest
 * topic on the centre line, what counts as typing, and the one memory cell the guide keeps.
 * The component's timers and observers are guide-assistant.test.tsx's.
 */

/** Nothing in the way. Typed in full, so a new blocker cannot be left out of the table. */
const CLEAR: GuideBlockers = {
  covered: false,
  intro: false,
  banner: false,
  typing: false,
  requestOpen: false,
  away: false,
  busy: false,
};
const BLOCKERS = Object.keys(CLEAR) as (keyof GuideBlockers)[];

/** A `performance.now()` reading for the last tip. */
const T0 = 12_345;

const memory = (over: Partial<GuideMemory> = {}): GuideMemory => ({ ...EMPTY_GUIDE_MEMORY, ...over });
const shown = (...topics: string[]): ReadonlySet<string> => new Set(topics);

/** What a memory holds, as plain data (the set spread out), to compare before and after. */
const snapshot = (m: GuideMemory) => ({ ...m, shown: [...m.shown] });

afterEach(() => {
  if (typeof document !== "undefined") document.body.replaceChildren();
});

describe("GUIDE_LIMITS", () => {
  it("lingers 5 s, cools down 60 s, shows at most 2 tips", () => {
    expect(GUIDE_LIMITS).toEqual({ lingerMs: 5000, cooldownMs: 60_000, maxPerSession: 2 });
  });
});

describe("EMPTY_GUIDE_MEMORY", () => {
  it("has shown nothing, has no last time and is not opted out", () => {
    expect(snapshot(EMPTY_GUIDE_MEMORY)).toEqual({ shown: [], count: 0, lastAt: null, optedOut: false });
  });

  it("is frozen", () => {
    expect(Object.isFrozen(EMPTY_GUIDE_MEMORY)).toBe(true);
  });
});

describe("canPrompt", () => {
  const oneShown = memory({ count: 1, shown: shown("servicii"), lastAt: T0 });

  it.each<{ name: string; m: GuideMemory; topic: string; now: number; expected: boolean }>([
    { name: "a fresh page, nothing in the way", m: memory(), topic: "servicii", now: T0, expected: true },
    { name: "a fresh page at time 0 (no last tip, no cooldown)", m: memory(), topic: "lucrari", now: 0, expected: true },
    { name: "opted out", m: memory({ optedOut: true }), topic: "servicii", now: T0, expected: false },
    {
      name: "count 2, a topic never shown, long after",
      m: memory({ count: 2, shown: shown("servicii", "lucrari"), lastAt: T0 }),
      topic: "service",
      now: T0 + 10 * 60_000,
      expected: false,
    },
    { name: "count 2 blocks on the count alone", m: memory({ count: 2 }), topic: "service", now: T0, expected: false },
    { name: "the topic already shown, long after", m: oneShown, topic: "servicii", now: T0 + 10 * 60_000, expected: false },
    { name: "cooldown: 59,999 ms after the last tip", m: oneShown, topic: "lucrari", now: T0 + 59_999, expected: false },
    { name: "cooldown: 60,000 ms after the last tip", m: oneShown, topic: "lucrari", now: T0 + 60_000, expected: true },
    {
      name: "a last tip at time 0 still cools down",
      m: memory({ count: 1, shown: shown("servicii"), lastAt: 0 }),
      topic: "lucrari",
      now: 59_999,
      expected: false,
    },
    { name: "a now that is not a number", m: memory(), topic: "servicii", now: Number.NaN, expected: false },
    { name: "a now that is infinite", m: memory(), topic: "servicii", now: Number.POSITIVE_INFINITY, expected: false },
  ])("$name → $expected", ({ m, topic, now, expected }) => {
    expect(canPrompt(m, topic, now, CLEAR)).toBe(expected);
  });

  it("knows exactly the seven blockers", () => {
    expect(BLOCKERS).toEqual(["covered", "intro", "banner", "typing", "requestOpen", "away", "busy"]);
  });

  it.each(BLOCKERS)("%s alone blocks a tip that would otherwise show", (name) => {
    const ready = memory({ count: 1, shown: shown("servicii"), lastAt: T0 });
    expect(canPrompt(ready, "lucrari", T0 + 60_000, CLEAR)).toBe(true);
    expect(canPrompt(ready, "lucrari", T0 + 60_000, { ...CLEAR, [name]: true })).toBe(false);
    expect(canPrompt(EMPTY_GUIDE_MEMORY, "servicii", T0, { ...CLEAR, [name]: true })).toBe(false);
  });

  it("reads the memory without changing it", () => {
    const m = memory({ count: 1, shown: shown("servicii"), lastAt: T0 });
    const before = snapshot(m);
    canPrompt(m, "lucrari", T0 + 60_000, CLEAR);
    expect(snapshot(m)).toEqual(before);
  });
});

describe("isFinal", () => {
  it("is false while a tip for the topic can still come", () => {
    expect(isFinal(EMPTY_GUIDE_MEMORY, "servicii")).toBe(false);
    const cooling = memory({ count: 1, shown: shown("servicii"), lastAt: T0 });
    expect(isFinal(cooling, "lucrari"), "the cooldown only postpones").toBe(false);
  });

  it("is true once opted out, at the limit, or for a topic already shown", () => {
    expect(isFinal(memory({ optedOut: true }), "servicii")).toBe(true);
    expect(isFinal(memory({ count: GUIDE_LIMITS.maxPerSession }), "service")).toBe(true);
    expect(isFinal(memory({ count: 1, shown: shown("lucrari") }), "lucrari")).toBe(true);
  });
});

describe("recordPrompt", () => {
  it("adds the topic, counts the tip and remembers when", () => {
    const next = recordPrompt(EMPTY_GUIDE_MEMORY, "servicii", T0);
    expect(snapshot(next)).toEqual({ shown: ["servicii"], count: 1, lastAt: T0, optedOut: false });
    expect(Object.isFrozen(next)).toBe(true);
  });

  it("never changes its input, the shown set included", () => {
    const m = memory({ count: 1, shown: shown("servicii"), lastAt: T0 });
    const before = snapshot(m);
    const next = recordPrompt(m, "lucrari", T0 + 60_000);
    expect(snapshot(m)).toEqual(before);
    expect(next.shown).not.toBe(m.shown);
    expect(snapshot(next)).toEqual({
      shown: ["servicii", "lucrari"],
      count: 2,
      lastAt: T0 + 60_000,
      optedOut: false,
    });
  });

  it("leaves EMPTY_GUIDE_MEMORY empty", () => {
    recordPrompt(EMPTY_GUIDE_MEMORY, "servicii", T0);
    recordPrompt(EMPTY_GUIDE_MEMORY, "lucrari", T0);
    expect(snapshot(EMPTY_GUIDE_MEMORY)).toEqual({ shown: [], count: 0, lastAt: null, optedOut: false });
  });

  it("plays a page lifetime: two tips a cooldown apart, then no third", () => {
    let m = EMPTY_GUIDE_MEMORY;
    expect(canPrompt(m, "servicii", T0, CLEAR)).toBe(true);
    m = recordPrompt(m, "servicii", T0);
    expect(canPrompt(m, "servicii", T0 + 5 * 60_000, CLEAR), "each topic once").toBe(false);
    expect(canPrompt(m, "lucrari", T0 + 30_000, CLEAR), "cooling down").toBe(false);
    expect(canPrompt(m, "lucrari", T0 + 60_000, CLEAR)).toBe(true);
    m = recordPrompt(m, "lucrari", T0 + 60_000);
    expect(canPrompt(m, "service", T0 + 10 * 60_000, CLEAR), "at most two").toBe(false);
    expect(isFinal(m, "service")).toBe(true);
  });

  it("keeps an opt-out", () => {
    expect(recordPrompt(optOut(EMPTY_GUIDE_MEMORY), "servicii", T0).optedOut).toBe(true);
  });
});

describe("optOut", () => {
  it("stops every topic and keeps the rest of the memory", () => {
    const m = memory({ count: 1, shown: shown("servicii"), lastAt: T0 });
    const next = optOut(m);
    expect(snapshot(next)).toEqual({ shown: ["servicii"], count: 1, lastAt: T0, optedOut: true });
    for (const topic of ["servicii", "lucrari", "service"]) {
      expect(isFinal(next, topic), topic).toBe(true);
      expect(canPrompt(next, topic, T0 + 10 * 60_000, CLEAR), topic).toBe(false);
    }
    expect(Object.isFrozen(next)).toBe(true);
  });

  it("never changes its input", () => {
    const m = memory({ count: 1, shown: shown("servicii"), lastAt: T0 });
    const before = snapshot(m);
    optOut(m);
    optOut(EMPTY_GUIDE_MEMORY);
    expect(snapshot(m)).toEqual(before);
    expect(EMPTY_GUIDE_MEMORY.optedOut).toBe(false);
  });
});

describe("pickTopic", () => {
  /** `#servicii` > article > `[data-guide-topic="service"]`, plus `#lucrari` beside it. */
  function page() {
    const servicii = document.createElement("section");
    servicii.id = "servicii";
    const article = document.createElement("article");
    const steps = document.createElement("div");
    steps.dataset.guideTopic = "service";
    article.append(steps);
    servicii.append(article);
    const lucrari = document.createElement("section");
    lucrari.id = "lucrari";
    document.body.append(servicii, lucrari);
    return { servicii, article, steps, lucrari };
  }

  it("is null with no hits", () => {
    expect(pickTopic([])).toBeNull();
  });

  it("answers a single hit", () => {
    const { lucrari } = page();
    expect(pickTopic([{ topic: "lucrari", el: lucrari }])).toBe("lucrari");
  });

  it("prefers the deepest element, whatever the order of the hits", () => {
    const { servicii, steps } = page();
    const outer = { topic: "servicii", el: servicii };
    const inner = { topic: "service", el: steps };
    expect(pickTopic([outer, inner])).toBe("service");
    expect(pickTopic([inner, outer])).toBe("service");
  });

  it("goes all the way down a chain of three", () => {
    const { servicii, article, steps } = page();
    const hits = [
      { topic: "servicii", el: servicii },
      { topic: "service", el: steps },
      { topic: "middle", el: article },
    ];
    expect(pickTopic(hits)).toBe("service");
    expect(pickTopic([...hits].reverse())).toBe("service");
  });

  it("breaks a tie with the first hit: side-by-side elements, or one element twice", () => {
    const { servicii, lucrari, steps } = page();
    expect(pickTopic([{ topic: "lucrari", el: lucrari }, { topic: "servicii", el: servicii }])).toBe("lucrari");
    expect(pickTopic([{ topic: "servicii", el: servicii }, { topic: "lucrari", el: lucrari }])).toBe("servicii");
    expect(pickTopic([{ topic: "service", el: steps }, { topic: "servicii", el: steps }])).toBe("service");
  });

  it("takes the first deepest when the deepest sit side by side under a shared parent", () => {
    const { servicii, article, lucrari } = page();
    const aside = document.createElement("aside");
    servicii.append(aside);
    const hits = [
      { topic: "servicii", el: servicii },
      { topic: "aside", el: aside },
      { topic: "article", el: article },
      { topic: "lucrari", el: lucrari },
    ];
    expect(pickTopic(hits)).toBe("aside");
  });

  it("still answers when a stub's contains loops (no deepest exists)", () => {
    const loop = { contains: () => true };
    expect(pickTopic([{ topic: "a", el: loop }, { topic: "b", el: { contains: () => true } }])).toBe("a");
  });
});

describe("isTypingTarget", () => {
  function input(type: string | null) {
    const el = document.createElement("input");
    if (type !== null) el.setAttribute("type", type);
    document.body.append(el);
    return el;
  }
  function editable(value: string) {
    const el = document.createElement("div");
    el.setAttribute("contenteditable", value);
    document.body.append(el);
    return el;
  }

  it.each(["email", "tel", "text", "search", "number", "url", "password", "date", "EMAIL", "not-a-type"])(
    "an input of type %s is typing",
    (type) => {
      expect(isTypingTarget(input(type))).toBe(true);
    },
  );

  it("an input with no type is typing", () => {
    expect(isTypingTarget(input(null))).toBe(true);
  });

  it.each(["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "image", "Checkbox"])(
    "an input of type %s is not typing",
    (type) => {
      expect(isTypingTarget(input(type))).toBe(false);
    },
  );

  it("textarea and select are typing", () => {
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    document.body.append(textarea, select);
    expect(isTypingTarget(textarea)).toBe(true);
    expect(isTypingTarget(select)).toBe(true);
  });

  it.each(["", "true", "plaintext-only", "TRUE"])('contenteditable="%s" is typing', (value) => {
    expect(isTypingTarget(editable(value))).toBe(true);
  });

  it("an element inside editable content is typing", () => {
    const host = editable("true");
    const span = document.createElement("span");
    host.append(span);
    expect(isTypingTarget(span)).toBe(true);
  });

  it('contenteditable="false" is not typing, nor is anything it switches off', () => {
    expect(isTypingTarget(editable("false"))).toBe(false);
    expect(isTypingTarget(editable("FALSE"))).toBe(false);
    const host = editable("true");
    const off = document.createElement("div");
    off.setAttribute("contenteditable", "false");
    const span = document.createElement("span");
    off.append(span);
    host.append(off);
    expect(isTypingTarget(span)).toBe(false);
  });

  it("null, a div, a button and a link are not typing", () => {
    const div = document.createElement("div");
    const button = document.createElement("button");
    const link = document.createElement("a");
    link.href = "#servicii";
    document.body.append(div, button, link);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(div)).toBe(false);
    expect(isTypingTarget(button)).toBe(false);
    expect(isTypingTarget(link)).toBe(false);
  });

  it("an svg is not typing and does not throw, even one named like a field", () => {
    const SVG = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(SVG, "svg");
    const text = document.createElementNS(SVG, "text");
    const fake = document.createElementNS(SVG, "textarea");
    svg.append(text, fake);
    document.body.append(svg);
    for (const el of [svg, text, fake]) {
      expect(() => isTypingTarget(el), el.localName).not.toThrow();
      expect(isTypingTarget(el), el.localName).toBe(false);
    }
  });
});

describe("createGuideMemoryStore", () => {
  it("starts empty, holds what it is given and resets to empty", () => {
    const store = createGuideMemoryStore();
    expect(store.get()).toBe(EMPTY_GUIDE_MEMORY);
    const next = recordPrompt(store.get(), "servicii", T0);
    store.set(next);
    expect(store.get()).toBe(next);
    store.set(optOut(store.get()));
    expect(store.get().optedOut).toBe(true);
    expect(store.get().count).toBe(1);
    store.reset();
    expect(store.get()).toBe(EMPTY_GUIDE_MEMORY);
  });

  it("gives each store its own cell", () => {
    const a = createGuideMemoryStore();
    const b = createGuideMemoryStore();
    a.set(recordPrompt(a.get(), "lucrari", T0));
    expect(a.get().count).toBe(1);
    expect(b.get()).toBe(EMPTY_GUIDE_MEMORY);
  });
});

describe("lib/hud/linger stays pure", () => {
  const withoutComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

  /** Every module a source names: static and side-effect imports, re-exports, import(), require(). */
  const specifiers = (src: string) =>
    [
      ...src.matchAll(/\bfrom\s*["']([^"']+)["']/g),
      ...src.matchAll(/\bimport\s*["']([^"']+)["']/g),
      ...src.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g),
      ...src.matchAll(/\brequire\s*\(\s*["']([^"']+)["']/g),
    ].map((m) => m[1]);

  /** React, the 3D and animation runtimes, icons, Next, and the site's DOM-heavy modules. */
  const HEAVY = [
    /^react(-dom)?(\/|$)/,
    /^three(\/|$)/,
    /^@react-three\//,
    /^gsap(\/|$)/,
    /^lucide-react(\/|$)/,
    /^next(\/|$)/,
    /(^|\/)components\//,
    /(^|\/)lib\/(scene|siteContent|scrollLock|intro|request\/)/,
  ];
  const heavy = (specifier: string) => HEAVY.some((pattern) => pattern.test(specifier));

  const source = withoutComments(readFileSync(resolve(process.cwd(), "lib/hud/linger.ts"), "utf8"));

  it("pins the import detector on fixtures", () => {
    const fixture = `import { useState } from "react"; import "three"; export { gsap } from "gsap/all";
      const fiber = await import("@react-three/fiber"); const s = require("@/lib/scene");
      import type { GuideTopic } from "@/lib/hud/topics";`;
    expect(specifiers(fixture)).toEqual(["react", "gsap/all", "@/lib/hud/topics", "three", "@react-three/fiber", "@/lib/scene"]);
    expect(specifiers(fixture).filter(heavy)).toEqual(["react", "gsap/all", "three", "@react-three/fiber", "@/lib/scene"]);
    expect(heavy("@/components/hud/guide/GuideAssistant")).toBe(true);
    expect(heavy("@/lib/hud/topics")).toBe(false);
  });

  it("imports nothing from react, three, gsap or the DOM-heavy modules (nothing at all today)", () => {
    expect(specifiers(source).filter(heavy)).toEqual([]);
    expect(specifiers(source)).toEqual([]);
  });

  it("has no client directive and reads no global: no DOM, no storage, no clock", () => {
    expect(source).not.toMatch(/^\s*["']use client["']/m);
    expect(source).not.toMatch(
      /\b(window|document|globalThis|localStorage|sessionStorage|indexedDB|navigator|performance|Date|setTimeout|IntersectionObserver)\b/,
    );
    expect(source).not.toMatch(/\bcookie/i);
  });

  describe("without a DOM", () => {
    beforeEach(() => {
      vi.resetModules();
      vi.stubGlobal("window", undefined);
      vi.stubGlobal("document", undefined);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("imports and decides", async () => {
      expect(typeof window).toBe("undefined");
      const linger = await import("@/lib/hud/linger");
      const store = linger.createGuideMemoryStore();
      expect(linger.canPrompt(store.get(), "servicii", T0, CLEAR)).toBe(true);
      store.set(linger.recordPrompt(store.get(), "servicii", T0));
      expect(linger.isFinal(store.get(), "servicii")).toBe(true);
      expect(linger.pickTopic([{ topic: "servicii", el: { contains: () => false } }])).toBe("servicii");
      expect(linger.isTypingTarget(null)).toBe(false);
    });
  });
});
