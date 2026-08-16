import { expect, test } from "@playwright/test";
import { SOUND_COOKIE } from "@/lib/sound/sound";
import {
  audioContextCount,
  countAudioContexts,
  gotoHydrated,
  seedConsent,
  seedSoundOn,
  soundCookie,
  soundToggle,
} from "./helpers";

/*
 * Interface sound (`components/ui/SoundToggle.tsx` + `lib/sound/`).
 *
 * The promises being guarded are all promises of SILENCE, and each one is checked at the
 * only place it can be checked honestly — the `AudioContext` constructor:
 *
 *   · sound is off until someone asks for it;
 *   · nothing is built while the page loads — no context on import, none on mount, not even
 *     for a returning visitor whose cookie says "on";
 *   · the choice survives a reload, through the `tbs_sound` cookie;
 *   · the first context appears strictly inside the click that turns sound on.
 *
 * `countAudioContexts()` wraps the constructor with `addInitScript`, so the count starts
 * before the app's first line runs and no `new AudioContext()` can slip in unseen. The
 * wrapper still returns a real context, so the app behaves exactly as it would unwatched.
 */

test.describe("interface sound", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test("it is off by default and nothing is built while the page loads @smoke", async ({
    page,
    context,
  }) => {
    await countAudioContexts(page);
    await gotoHydrated(page, "/");

    const toggle = soundToggle(page);
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    // A fresh visitor has no preference stored — "off" is the absence of a cookie.
    expect(await soundCookie(context)).toBeUndefined();

    // Everything a page does on its own: finish loading, run its effects, scroll.
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(300);

    expect(
      await audioContextCount(page),
      "no AudioContext may be constructed while the page merely loads",
    ).toBe(0);
  });

  test("the first AudioContext appears inside the click that turns sound on", async ({
    page,
  }) => {
    await countAudioContexts(page);
    await gotoHydrated(page, "/");

    expect(await audioContextCount(page)).toBe(0);

    await soundToggle(page).click();
    await expect(soundToggle(page)).toHaveAttribute("aria-pressed", "true");

    // Turning it ON says one word about itself — and that press is a real user gesture, so
    // the latch in `player.ts` is open and the context is finally allowed to exist.
    await expect
      .poll(
        () => audioContextCount(page),
        { message: "the confirmation tone should have created the audio context" },
      )
      .toBe(1);

    // Lazily, and once: a second press does not build a second context.
    await soundToggle(page).click();
    await expect(soundToggle(page)).toHaveAttribute("aria-pressed", "false");
    expect(await audioContextCount(page)).toBe(1);
  });

  test("the choice persists across a reload", async ({ page, context }) => {
    await gotoHydrated(page, "/");
    await expect(soundToggle(page)).toHaveAttribute("aria-pressed", "false");

    await soundToggle(page).click();
    await expect(soundToggle(page)).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => soundCookie(context), { message: `${SOUND_COOKIE} should be "on"` })
      .toBe("on");

    await gotoHydrated(page, "/");
    await expect(
      soundToggle(page),
      "a reload must not forget that sound was turned on",
    ).toHaveAttribute("aria-pressed", "true");

    // …and turning it back off DROPS the cookie rather than storing a second value, so a
    // truncated or corrupted cookie can only ever fail towards silence.
    await soundToggle(page).click();
    await expect(soundToggle(page)).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => soundCookie(context)).toBeUndefined();

    await gotoHydrated(page, "/");
    await expect(soundToggle(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("a returning visitor with sound ON still hears nothing before a gesture", async ({
    page,
    context,
    baseURL,
  }) => {
    await seedSoundOn(context, baseURL!);
    await countAudioContexts(page);
    await gotoHydrated(page, "/");

    // The cookie is honoured — this is genuinely the "sound is on" state…
    await expect(soundToggle(page)).toHaveAttribute("aria-pressed", "true");

    // …and it is still completely silent, because nothing has been touched yet.
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(300);

    expect(
      await audioContextCount(page),
      "sound being ON must not make the page autoplay anything",
    ).toBe(0);
  });
});
