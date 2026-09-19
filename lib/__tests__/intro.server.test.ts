import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * `lib/intro.ts` on the server: the `(site)` layout imports it to gate the overlay, and
 * `e2e/helpers.ts` imports it into plain Node. No DOM exists there, so the import itself
 * must not touch one, and every DOM-facing function must be a quiet no-op.
 *
 * Not a per-file "node" environment docblock: `vitest.setup.ts` reads `window.matchMedia`
 * at its top level and throws before such a file can run. Instead the DOM globals are
 * removed here and the module is imported FRESH (`vi.resetModules`), so its top level
 * really executes without `window` or `document`.
 */

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", undefined);
  vi.stubGlobal("document", undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const importIntro = () => import("@/lib/intro");

describe("lib/intro without a DOM", () => {
  it("imports with no window or document", async () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
    await expect(importIntro()).resolves.toHaveProperty("INTRO_COOKIE", "tbs_intro_skip");
  });

  it("still reads the cookie value and the cookie header", async () => {
    const { INTRO_COOKIE, INTRO_SEEN, isIntroSeen, readIntroSeen } = await importIntro();
    expect(isIntroSeen(INTRO_SEEN)).toBe(true);
    expect(isIntroSeen("junk")).toBe(false);
    expect(readIntroSeen(`tbs_locale=ru; ${INTRO_COOKIE}=seen`)).toBe(true);
    // The name it was renamed away from must not gate the server's decision either.
    expect(readIntroSeen("tbs_locale=ru; tbs_intro=seen")).toBe(false);
  });

  it("reports nothing pending, and finishing or subscribing does not throw", async () => {
    const { finishIntro, isIntroPending, onIntroDone } = await importIntro();
    expect(isIntroPending()).toBe(false);
    expect(() => finishIntro({ played: true })).not.toThrow();

    const callback = vi.fn();
    let unsubscribe: (() => void) | undefined;
    expect(() => {
      unsubscribe = onIntroDone(callback);
    }).not.toThrow();
    expect(callback).toHaveBeenCalledWith({ played: false });
    expect(() => unsubscribe?.()).not.toThrow();
  });

  it("does not remember a server-side finish for the next request", async () => {
    const { finishIntro, isIntroPending } = await importIntro();
    finishIntro({ played: true });
    // Back in a DOM with an overlay, the same module instance must still see it pending.
    vi.unstubAllGlobals();
    const overlay = document.createElement("div");
    overlay.id = "tbs-intro";
    document.body.appendChild(overlay);
    try {
      expect(isIntroPending()).toBe(true);
    } finally {
      overlay.remove();
    }
  });
});
