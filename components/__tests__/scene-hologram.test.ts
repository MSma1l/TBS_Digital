import { afterEach, describe, expect, it, vi } from "vitest";
import { LinearFilter, NoColorSpace } from "three";
import {
  HOLOGRAM,
  HOLOGRAM_MAX,
  clampHologramSize,
  composeHologram,
  createHologramSource,
} from "@/components/scene/three/hologram";
import { SCENE_TIER_CONFIG } from "@/components/scene/tiers";

/*
 * The Work hologram's texture (three/hologram.ts): the front card composed from its own DOM on a
 * small canvas. A fake 2D context records every call, so the privacy and CSP rules are pinned
 * here: only a same-origin screenshot that decoded is drawn, a tainted canvas falls back to text
 * without throwing, the canvas never exceeds the high tier's 384×240, the fonts are the card's
 * own, the tag's "·" joints are not chips — and the source composes only in an idle slot, for a
 * real card, and again when the page's language changes.
 */

type Call = { name: string; args: unknown[]; composite: string };

function fakeContext(options: { taint?: boolean } = {}) {
  const calls: Call[] = [];
  const fonts: string[] = [];
  const texts: string[] = [];
  let font = "10px sans-serif";
  const target: Record<string, unknown> = {
    canvas: { width: 384, height: 240 },
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    textAlign: "start",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    measureText: (text: string) => ({ width: text.length * 6 }),
    getImageData: (...args: unknown[]) => {
      calls.push({ name: "getImageData", args, composite: String(target.globalCompositeOperation) });
      if (options.taint) throw new DOMException("The canvas has been tainted by cross-origin data.", "SecurityError");
      return { data: new Uint8ClampedArray(4), width: 1, height: 1 };
    },
  };
  Object.defineProperty(target, "font", {
    get: () => font,
    set: (value: string) => {
      font = value;
      fonts.push(value);
    },
  });
  for (const name of [
    "setTransform",
    "clearRect",
    "fillRect",
    "strokeRect",
    "drawImage",
    "beginPath",
    "moveTo",
    "lineTo",
    "stroke",
    "fillText",
    "strokeText",
  ]) {
    target[name] = (...args: unknown[]) => {
      calls.push({ name, args, composite: String(target.globalCompositeOperation) });
      if (name === "fillText" || name === "strokeText") texts.push(String(args[0]));
    };
  }
  return { ctx: target as unknown as CanvasRenderingContext2D, calls, fonts, texts };
}

const SAME_ORIGIN = () => new URL("/projects/flirt-1.png", location.href).href;

/** A card as Work.tsx renders it: screenshot, tag chips joined by "·" spans, index, name. */
function makeCard(options: { src?: string | null; name?: string; tags?: string[]; decode?: "ok" | "never" | "fail" } = {}) {
  const { src = SAME_ORIGIN(), name = "Flirt", tags = ["Aplicație web", "Social"], decode = "ok" } = options;
  const card = document.createElement("a");
  if (src !== null) {
    const media = document.createElement("div");
    const img = document.createElement("img");
    img.setAttribute("src", src);
    img.alt = name;
    Object.defineProperty(img, "naturalWidth", { value: 1021 });
    Object.defineProperty(img, "naturalHeight", { value: 762 });
    const decodeImpl =
      decode === "ok"
        ? () => Promise.resolve()
        : decode === "fail"
          ? () => Promise.reject(new Error("decode failed"))
          : () => new Promise<void>(() => {});
    Object.defineProperty(img, "decode", { value: vi.fn(decodeImpl) });
    media.append(img);
    card.append(media);
  }
  const header = document.createElement("div");
  const small = document.createElement("small");
  tags.forEach((tag, n) => {
    if (n > 0) {
      const joint = document.createElement("span");
      joint.className = "joint";
      joint.textContent = " · ";
      small.append(joint);
    }
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = tag;
    small.append(chip);
  });
  const index = document.createElement("span");
  index.setAttribute("aria-hidden", "true");
  index.textContent = "01";
  header.append(small, index);
  const h3 = document.createElement("h3");
  h3.textContent = `  ${name}\n `;
  card.append(header, h3);
  document.body.append(card);
  return { card, img: card.querySelector("img") };
}

/** The card's computed fonts, as the page's next/font families would come back. */
function stubFonts() {
  const real = window.getComputedStyle.bind(window);
  return vi.spyOn(window, "getComputedStyle").mockImplementation((element: Element) => {
    if (element.tagName === "H3") return { fontFamily: '"Orbitron", "Orbitron Fallback", sans-serif', fontWeight: "900" } as CSSStyleDeclaration;
    if ((element as HTMLElement).className === "chip") return { fontFamily: '"Share Tech Mono", monospace', fontWeight: "700" } as CSSStyleDeclaration;
    return real(element);
  });
}

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.lang = "";
  vi.useRealTimers();
});

describe("composeHologram — what may be drawn", () => {
  it("a same-origin screenshot that decodes: luminosity over black in 2px cells, top-aligned, scanlines every 3px, then the text", async () => {
    const { card, img } = makeCard();
    const fake = fakeContext();
    await expect(composeHologram(card, fake.ctx, [384, 240], 0)).resolves.toBe("image");
    expect(img!.decode).toHaveBeenCalledTimes(1);
    const band = Math.round(240 * HOLOGRAM.band);
    const draws = fake.calls.filter((call) => call.name === "drawImage");
    expect(draws).toHaveLength(2);
    // The screenshot into the cells: top-aligned (sy 0), centred crop, luminosity composite.
    const [source, sx, sy, sw, sh, dx, dy, dw, dh] = draws[0].args as [unknown, ...number[]];
    expect(source).toBe(img);
    expect(draws[0].composite).toBe("luminosity");
    expect([dx, dy, dw, dh]).toEqual([0, 0, 384 / HOLOGRAM.cell, Math.round(band / HOLOGRAM.cell)]);
    expect(sy).toBe(0);
    expect(sx).toBeCloseTo((1021 - sw) / 2, 9);
    expect(sw / sh).toBeCloseTo(dw / dh, 9);
    // …then scaled back up over the band from the canvas itself.
    expect(draws[1].args[0]).toBe(fake.ctx.canvas);
    expect(draws[1].args.slice(5)).toEqual([0, 0, 384, band]);
    expect(draws[1].composite).toBe("source-over");
    const black = fake.calls.findIndex((call) => call.name === "fillRect" && (call.args as number[])[3] === band);
    expect(black).toBeGreaterThanOrEqual(0);
    expect(black).toBeLessThan(fake.calls.indexOf(draws[0]));
    const scanlines = fake.calls.filter((call) => call.name === "fillRect" && (call.args as number[])[3] === 1);
    expect(scanlines.map((call) => (call.args as number[])[1])).toEqual(
      Array.from({ length: Math.ceil(band / HOLOGRAM.scanEvery) }, (_, k) => k * HOLOGRAM.scanEvery),
    );
    expect(fake.texts).toContain("FLIRT");
    // One readback per compose: the single-pixel taint probe, after the screenshot.
    const probes = fake.calls.filter((call) => call.name === "getImageData");
    expect(probes).toHaveLength(1);
    expect(probes[0].args).toEqual([0, 0, 1, 1]);
    expect(fake.calls.indexOf(probes[0])).toBeGreaterThan(fake.calls.indexOf(draws[1]));
  });

  it("a cross-origin screenshot is never decoded or drawn: text only", async () => {
    const { card, img } = makeCard({ src: "https://cdn.example.com/flirt-1.png" });
    const fake = fakeContext();
    await expect(composeHologram(card, fake.ctx, [384, 240], 3)).resolves.toBe("text");
    expect(img!.decode).not.toHaveBeenCalled();
    expect(fake.calls.filter((call) => call.name === "drawImage")).toEqual([]);
    expect(fake.calls.filter((call) => call.name === "getImageData")).toEqual([]);
    expect(fake.texts).toEqual(expect.arrayContaining(["04", "APLICAȚIE WEB", "SOCIAL", "FLIRT"]));
  });

  it("no screenshot, one that fails to decode, or one that never decodes within 1.5s: text only", async () => {
    const none = makeCard({ src: null });
    await expect(composeHologram(none.card, fakeContext().ctx, [384, 240], 0)).resolves.toBe("text");

    const failing = makeCard({ decode: "fail" });
    const fake = fakeContext();
    await expect(composeHologram(failing.card, fake.ctx, [384, 240], 0)).resolves.toBe("text");
    expect(fake.calls.filter((call) => call.name === "drawImage")).toEqual([]);

    vi.useFakeTimers();
    const stuck = makeCard({ decode: "never" });
    const slow = fakeContext();
    const result = composeHologram(stuck.card, slow.ctx, [384, 240], 0);
    await vi.advanceTimersByTimeAsync(HOLOGRAM.decodeMs - 1);
    expect(slow.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe("text");
    expect(slow.calls.filter((call) => call.name === "drawImage")).toEqual([]);
  });

  it("a tainted canvas (getImageData throws) is cleared and drawn text-only, never rethrown", async () => {
    const { card } = makeCard();
    const fake = fakeContext({ taint: true });
    await expect(composeHologram(card, fake.ctx, [384, 240], 0)).resolves.toBe("text");
    const names = fake.calls.map((call) => call.name);
    const probe = names.indexOf("getImageData");
    expect(probe).toBeGreaterThan(names.indexOf("drawImage"));
    // Cleared whole right after the failed probe, before any text.
    expect(names[probe + 1]).toBe("clearRect");
    expect(fake.calls[probe + 1].args).toEqual([0, 0, 384, 240]);
    expect(names.slice(0, probe)).not.toContain("fillText");
    expect(fake.texts).toContain("FLIRT");
  });

  it("the fonts are the card's computed ones: the name at 900 upper case, the chips in theirs, the index outlined", async () => {
    stubFonts();
    const { card } = makeCard({ name: "Crowe Portal" });
    const fake = fakeContext();
    await composeHologram(card, fake.ctx, [384, 240], 1);
    expect(fake.fonts).toContain('900 24px "Orbitron", "Orbitron Fallback", sans-serif');
    expect(fake.fonts).toContain('800 30px "Orbitron", "Orbitron Fallback", sans-serif');
    expect(fake.fonts).toContain('700 11px "Share Tech Mono", monospace');
    const name = fake.calls.find((call) => call.name === "fillText" && call.args[0] === "CROWE PORTAL");
    expect(name).toBeDefined();
    const index = fake.calls.find((call) => call.name === "strokeText");
    expect(index?.args[0]).toBe("02");
  });

  it("the tag's '·' joints are skipped: each chip drawn once, in a hairline box, upper case in the page's language", async () => {
    document.documentElement.lang = "ro";
    const { card } = makeCard({ tags: ["crm privat", "fără link", "intern"] });
    const fake = fakeContext();
    await composeHologram(card, fake.ctx, [384, 240], 0);
    const chips = fake.calls.filter((call) => call.name === "fillText").map((call) => call.args[0]);
    expect(chips).toEqual(["CRM PRIVAT", "FĂRĂ LINK", "INTERN", "FLIRT"]);
    expect(fake.texts.some((text) => text.includes("·"))).toBe(false);
    expect(fake.calls.filter((call) => call.name === "strokeRect")).toHaveLength(3);
  });

  it("a long name shrinks, then is cut with an ellipsis, inside the padding", async () => {
    const { card } = makeCard({ name: "A very long project name that cannot possibly fit on one hologram line" });
    const fake = fakeContext();
    await composeHologram(card, fake.ctx, [384, 240], 0);
    const drawn = fake.calls.find((call) => call.name === "fillText" && String(call.args[0]).startsWith("A VERY"));
    expect(String(drawn!.args[0]).endsWith("…")).toBe(true);
    expect(String(drawn!.args[0]).length * 6).toBeLessThanOrEqual(384 - 2 * HOLOGRAM.pad);
  });

  it("the bracket corners are straight lines (no arcs, no dots)", async () => {
    const { card } = makeCard({ src: null });
    const fake = fakeContext();
    await composeHologram(card, fake.ctx, [384, 240], 0);
    expect(fake.calls.filter((call) => call.name === "moveTo")).toHaveLength(4);
    expect(fake.calls.filter((call) => call.name === "lineTo")).toHaveLength(8);
    expect(fake.ctx.lineCap).toBe("butt");
    expect(Object.keys(fake.ctx)).not.toContain("arc");
  });
});

describe("hologram size", () => {
  it("is clamped to the high tier's 384×240 (the mid tier draws 256×160)", async () => {
    expect(HOLOGRAM_MAX).toEqual([384, 240]);
    expect(HOLOGRAM_MAX).toEqual(SCENE_TIER_CONFIG.high.hologram);
    expect(SCENE_TIER_CONFIG.mid.hologram).toEqual([256, 160]);
    expect(clampHologramSize([1920, 1200])).toEqual([384, 240]);
    expect(clampHologramSize([256, 160])).toEqual([256, 160]);
    expect(clampHologramSize([255.6, 159.4])).toEqual([256, 159]);
    expect(clampHologramSize([0, -5])).toEqual([16, 10]);
    expect(clampHologramSize([Number.NaN, Number.POSITIVE_INFINITY])).toEqual([384, 240]);

    const { card } = makeCard();
    const fake = fakeContext();
    await composeHologram(card, fake.ctx, [1920, 1200], 0);
    expect(fake.calls.find((call) => call.name === "clearRect")?.args).toEqual([0, 0, 384, 240]);
    const scaledUp = fake.calls.filter((call) => call.name === "drawImage")[1];
    expect(scaledUp.args.slice(7)).toEqual([384, Math.round(240 * HOLOGRAM.band)]);
  });
});

describe("createHologramSource", () => {
  type IdleCallback = () => void;

  function idleSlots() {
    const pending = new Map<number, IdleCallback>();
    let next = 1;
    const request = vi.fn((callback: IdleCallback) => {
      pending.set(next, callback);
      return next++;
    });
    const cancel = vi.fn((id: number) => {
      pending.delete(id);
    });
    Object.assign(window, { requestIdleCallback: request, cancelIdleCallback: cancel });
    return {
      request,
      cancel,
      pending: () => pending.size,
      /** Run every waiting slot, then let the compose settle. */
      async run() {
        const callbacks = [...pending.values()];
        pending.clear();
        for (const callback of callbacks) callback();
        for (let i = 0; i < 20; i += 1) await Promise.resolve();
      },
    };
  }

  function withContext() {
    const fake = fakeContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => fake.ctx) as never);
    return fake;
  }

  afterEach(() => {
    Reflect.deleteProperty(window, "requestIdleCallback");
    Reflect.deleteProperty(window, "cancelIdleCallback");
  });

  it("one canvas texture at the tier's size (clamped): a CPU-backed 2D context, no mipmaps, linear filters, no colour space", () => {
    withContext();
    const getContext = vi.mocked(HTMLCanvasElement.prototype.getContext);
    const mid = createHologramSource(SCENE_TIER_CONFIG.mid.hologram, () => {});
    const image = mid.texture.image as HTMLCanvasElement;
    expect([image.width, image.height]).toEqual([256, 160]);
    expect(mid.texture.generateMipmaps).toBe(false);
    expect(mid.texture.minFilter).toBe(LinearFilter);
    expect(mid.texture.magFilter).toBe(LinearFilter);
    expect(mid.texture.colorSpace).toBe(NoColorSpace);
    // It only feeds a texture upload and a one-pixel probe: read back from memory, no GPU stall.
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(getContext).toHaveBeenCalledWith("2d", { willReadFrequently: true });
    mid.dispose();
    const big = createHologramSource([1024, 640], () => {});
    expect([(big.texture.image as HTMLCanvasElement).width, (big.texture.image as HTMLCanvasElement).height]).toEqual([384, 240]);
    big.dispose();
  });

  it("request(null) does nothing: no idle slot, no drawing, no swap", async () => {
    const slots = idleSlots();
    const fake = withContext();
    const onSwap = vi.fn();
    const source = createHologramSource([384, 240], onSwap);
    const version = source.texture.version;
    source.request(null, 0);
    expect(slots.request).not.toHaveBeenCalled();
    await slots.run();
    expect(fake.calls).toEqual([]);
    expect(onSwap).not.toHaveBeenCalled();
    expect(source.texture.version).toBe(version);
    source.dispose();
  });

  it("composes in an idle slot — a newer request replaces a pending one — then flags the texture and calls onSwap once", async () => {
    const slots = idleSlots();
    const fake = withContext();
    const onSwap = vi.fn();
    const source = createHologramSource([384, 240], onSwap);
    const version = source.texture.version;
    const first = makeCard({ name: "Bizcheck" });
    const second = makeCard({ name: "Docusafe" });
    source.request(first.card, 0);
    expect(fake.calls).toEqual([]);
    source.request(second.card, 1);
    expect(slots.cancel).toHaveBeenCalledTimes(1);
    expect(slots.pending()).toBe(1);
    await slots.run();
    expect(fake.texts).toContain("DOCUSAFE");
    expect(fake.texts).not.toContain("BIZCHECK");
    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(source.texture.version).toBe(version + 1);
    // The same card again, already drawn with its screenshot: nothing to do.
    source.request(second.card, 1);
    expect(slots.pending()).toBe(0);
    source.dispose();
  });

  it("a change of <html lang> composes the current card again", async () => {
    const slots = idleSlots();
    const fake = withContext();
    const onSwap = vi.fn();
    const source = createHologramSource([384, 240], onSwap);
    const { card } = makeCard({ name: "Iq Arena" });
    source.request(card, 5);
    await slots.run();
    expect(onSwap).toHaveBeenCalledTimes(1);
    card.querySelector("h3")!.textContent = "Ик Арена";
    document.documentElement.lang = "ru";
    await Promise.resolve();
    await Promise.resolve();
    expect(slots.pending()).toBe(1);
    await slots.run();
    expect(onSwap).toHaveBeenCalledTimes(2);
    expect(fake.texts).toContain("ИК АРЕНА");
    // Two composes of a card with a screenshot: two single-pixel probes, nothing else read back.
    expect(fake.calls.filter((call) => call.name === "getImageData").map((call) => call.args)).toHaveLength(2);
    source.dispose();
  });

  it("dispose: a pending slot is cancelled, a running compose never swaps, and a language change does nothing", async () => {
    const slots = idleSlots();
    withContext();
    const onSwap = vi.fn();
    const source = createHologramSource([384, 240], onSwap);
    const { card } = makeCard();
    source.request(card, 0);
    source.dispose();
    expect(slots.pending()).toBe(0);
    document.documentElement.lang = "en";
    await Promise.resolve();
    await slots.run();
    expect(slots.request).toHaveBeenCalledTimes(1);
    expect(onSwap).not.toHaveBeenCalled();
  });

  it("without requestIdleCallback it waits for a timer, never composing in the requesting task", async () => {
    vi.useFakeTimers();
    const fake = withContext();
    const onSwap = vi.fn();
    const source = createHologramSource([384, 240], onSwap);
    const { card } = makeCard({ src: null });
    source.request(card, 0);
    expect(fake.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(50);
    expect(onSwap).toHaveBeenCalledTimes(1);
    source.dispose();
  });
});
